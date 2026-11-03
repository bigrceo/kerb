// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title Desk
/// @notice Wallet-to-wallet OTC for ERC-20 tokens on Robinhood Chain.
///
/// Asks
///   A maker locks a bag of tokens here and names a total price in ETH. A taker pays
///   the ETH (plus the taker fee) and receives the tokens in the same transaction.
///
/// Bids
///   A maker locks ETH here for an amount of a token. A holder sends the tokens straight
///   to the maker and receives the ETH (minus the taker fee) in the same transaction.
///
/// Every fill is atomic: both legs move or neither does. No pool is touched, so no pool
/// price moves. The contract holds nothing but the escrow of open offers: a cancel or an
/// expiry hands it back to the maker, never to anyone else.
///
/// Offers can be private (one named taker), allow partial fills down to a smallest fill,
/// and stand until an expiry. Tokens that move by anything but the exact amount
/// (fee-on-transfer, rebasing) are refused.
contract Desk is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* --------------------------------- errors -------------------------------- */

    error ZeroAmount();
    error BadMinFill();
    error BadExpiry();
    error InexactTransfer();
    error NotOpen();
    error Expired();
    error NotExpired();
    error NotMaker();
    error NotTaker();
    error SelfFill();
    error BadFill();
    error WrongValue();
    error PayFailed();
    error NotAdmin();

    /* --------------------------------- events -------------------------------- */

    event OfferPosted(
        uint256 indexed id,
        address indexed maker,
        address indexed token,
        Side side,
        uint256 amount,
        uint256 total,
        uint256 minFill,
        address taker,
        uint64 expiry
    );
    event OfferFilled(
        uint256 indexed id, address indexed taker, uint256 tokens, uint256 eth, uint256 fee, uint256 remaining
    );
    event OfferClosed(uint256 indexed id, bool cancelled, uint256 refundedTokens, uint256 refundedEth);
    event TreasurySet(address treasury);

    /* -------------------------------- constants ------------------------------ */

    /// @notice Taker fee on the ETH leg, in basis points. The maker pays nothing.
    uint256 public constant FEE_BPS = 30;
    uint64 public constant MAX_DURATION = 30 days;

    /* --------------------------------- state --------------------------------- */

    enum Side {
        Ask, // maker sells tokens for ETH
        Bid // maker buys tokens with ETH
    }

    struct Offer {
        address maker;
        address token;
        address taker; // zero = anyone
        uint64 expiry;
        Side side;
        bool open;
        uint256 amount; // tokens, whole offer
        uint256 total; // wei, whole offer
        uint256 filled; // tokens filled so far
        uint256 minFill; // smallest fill in tokens; == amount means all-or-nothing
    }

    Offer[] internal _offers;

    address public admin;
    address public treasury;

    /// @notice Settled ETH, all offers, fees excluded.
    uint256 public volume;
    uint256 public fills;

    constructor(address treasury_) {
        admin = msg.sender;
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setTreasury(address t) external {
        if (msg.sender != admin) revert NotAdmin();
        treasury = t;
        emit TreasurySet(t);
    }

    function setAdmin(address a) external {
        if (msg.sender != admin) revert NotAdmin();
        admin = a;
    }

    /* ================================== make ================================== */

    /// @notice Lock `amount` tokens and ask `total` wei for all of them.
    function postAsk(address token, uint256 amount, uint256 total, uint256 minFill, address taker, uint64 expiry)
        external
        nonReentrant
        returns (uint256 id)
    {
        _check(amount, total, minFill, taker, expiry);
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(token).balanceOf(address(this)) - before != amount) revert InexactTransfer();
        id = _push(Side.Ask, token, amount, total, minFill, taker, expiry);
    }

    /// @notice Lock `msg.value` wei and bid it for `amount` tokens.
    function postBid(address token, uint256 amount, uint256 minFill, address taker, uint64 expiry)
        external
        payable
        nonReentrant
        returns (uint256 id)
    {
        _check(amount, msg.value, minFill, taker, expiry);
        id = _push(Side.Bid, token, amount, msg.value, minFill, taker, expiry);
    }

    function _check(uint256 amount, uint256 total, uint256 minFill, address taker, uint64 expiry) internal view {
        if (taker == msg.sender) revert SelfFill();
        if (amount == 0 || total == 0) revert ZeroAmount();
        if (minFill == 0 || minFill > amount) revert BadMinFill();
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_DURATION) revert BadExpiry();
    }

    function _push(Side side, address token, uint256 amount, uint256 total, uint256 minFill, address taker, uint64 expiry)
        internal
        returns (uint256 id)
    {
        id = _offers.length;
        _offers.push(
            Offer({
                maker: msg.sender,
                token: token,
                taker: taker,
                expiry: expiry,
                side: side,
                open: true,
                amount: amount,
                total: total,
                filled: 0,
                minFill: minFill
            })
        );
        emit OfferPosted(id, msg.sender, token, side, amount, total, minFill, taker, expiry);
    }

    /* ================================== take ================================== */

    /// @notice ETH owed for the next `tokens` of an offer. Cumulative rounding, so the
    ///         fills of an offer always add up to its exact total.
    function quote(uint256 id, uint256 tokens) public view returns (uint256 eth, uint256 fee) {
        Offer storage o = _offers[id];
        eth = _ethAt(o, o.filled + tokens) - _ethAt(o, o.filled);
        fee = eth * FEE_BPS / 10_000;
    }

    function _ethAt(Offer storage o, uint256 tokens) internal view returns (uint256) {
        return o.total * tokens / o.amount;
    }

    /// @notice Fill `tokens` of an ask. Send exactly the ETH price plus the taker fee.
    function takeAsk(uint256 id, uint256 tokens) external payable nonReentrant {
        Offer storage o = _offers[id];
        if (o.side != Side.Ask) revert NotOpen();
        uint256 remaining = _admit(o, tokens);
        (uint256 eth, uint256 fee) = quote(id, tokens);
        if (msg.value != eth + fee) revert WrongValue();

        o.filled += tokens;
        if (remaining == tokens) o.open = false;
        volume += eth;
        fills++;

        IERC20(o.token).safeTransfer(msg.sender, tokens);
        _pay(o.maker, eth);
        _pay(treasury, fee);
        emit OfferFilled(id, msg.sender, tokens, eth, fee, remaining - tokens);
    }

    /// @notice Fill `tokens` of a bid. The tokens go from you straight to the maker.
    function takeBid(uint256 id, uint256 tokens) external nonReentrant {
        Offer storage o = _offers[id];
        if (o.side != Side.Bid) revert NotOpen();
        uint256 remaining = _admit(o, tokens);
        (uint256 eth, uint256 fee) = quote(id, tokens);

        o.filled += tokens;
        if (remaining == tokens) o.open = false;
        volume += eth;
        fills++;

        IERC20 t = IERC20(o.token);
        uint256 before = t.balanceOf(o.maker);
        t.safeTransferFrom(msg.sender, o.maker, tokens);
        if (t.balanceOf(o.maker) - before != tokens) revert InexactTransfer();
        _pay(msg.sender, eth - fee);
        _pay(treasury, fee);
        emit OfferFilled(id, msg.sender, tokens, eth, fee, remaining - tokens);
    }

    /// @dev Checks a fill against the offer's terms; returns what was left before it.
    function _admit(Offer storage o, uint256 tokens) internal view returns (uint256 remaining) {
        if (!o.open) revert NotOpen();
        if (block.timestamp >= o.expiry) revert Expired();
        if (msg.sender == o.maker) revert SelfFill();
        if (o.taker != address(0) && msg.sender != o.taker) revert NotTaker();
        remaining = o.amount - o.filled;
        if (tokens == 0 || tokens > remaining) revert BadFill();
        // Below the smallest fill only to take exactly what is left.
        if (tokens < o.minFill && tokens != remaining) revert BadFill();
        // A fill may not leave a remainder nobody can take.
        if (remaining - tokens != 0 && remaining - tokens < o.minFill) revert BadFill();
    }

    /* ================================== close ================================= */

    /// @notice The maker takes an offer down at any time and gets its escrow back.
    function cancel(uint256 id) external nonReentrant {
        Offer storage o = _offers[id];
        if (msg.sender != o.maker) revert NotMaker();
        _close(id, o, true);
    }

    /// @notice After expiry anyone can return an offer's escrow to its maker.
    function reclaim(uint256 id) external nonReentrant {
        Offer storage o = _offers[id];
        if (block.timestamp < o.expiry) revert NotExpired();
        _close(id, o, false);
    }

    function _close(uint256 id, Offer storage o, bool cancelled) internal {
        if (!o.open) revert NotOpen();
        o.open = false;
        uint256 leftTokens = o.amount - o.filled;
        if (o.side == Side.Ask) {
            IERC20(o.token).safeTransfer(o.maker, leftTokens);
            emit OfferClosed(id, cancelled, leftTokens, 0);
        } else {
            uint256 leftEth = o.total - _ethAt(o, o.filled);
            _pay(o.maker, leftEth);
            emit OfferClosed(id, cancelled, 0, leftEth);
        }
    }

    function _pay(address to, uint256 wei_) internal {
        if (wei_ == 0) return;
        (bool ok,) = to.call{value: wei_}("");
        if (!ok) revert PayFailed();
    }

    /* ================================== views ================================= */

    function offer(uint256 id) external view returns (Offer memory) {
        return _offers[id];
    }

    function offerCount() external view returns (uint256) {
        return _offers.length;
    }

    /// @notice A page of offers, newest last.
    function offers(uint256 from, uint256 count) external view returns (Offer[] memory page) {
        uint256 n = _offers.length;
        if (from >= n) return page;
        if (count > n - from) count = n - from;
        page = new Offer[](count);
        for (uint256 i; i < count; i++) {
            page[i] = _offers[from + i];
        }
    }
}
