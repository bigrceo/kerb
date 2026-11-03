// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Desk} from "../src/Desk.sol";

contract Coin is ERC20 {
    constructor() ERC20("Coin", "COIN") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// Takes 1% of every transfer.
contract TaxCoin is ERC20 {
    constructor() ERC20("Tax", "TAX") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function _update(address from, address to, uint256 v) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 cut = v / 100;
            super._update(from, address(0xdead), cut);
            v -= cut;
        }
        super._update(from, to, v);
    }
}

/// Refuses ETH.
contract NoEth {}

/// Tries to fill again from inside the ETH payout.
contract Reenterer {
    Desk desk;
    uint256 id;

    constructor(Desk d) {
        desk = d;
    }

    function bid(address token, uint256 amount) external payable {
        id = desk.postBid{value: msg.value}(token, amount, amount, address(0), uint64(block.timestamp + 1 days));
    }

    function cancel() external {
        desk.cancel(id);
    }

    receive() external payable {
        desk.cancel(id);
    }
}

contract DeskTest is Test {
    Desk desk;
    Coin coin;
    address treasury = makeAddr("treasury");
    address maker = makeAddr("maker");
    address taker = makeAddr("taker");
    address other = makeAddr("other");

    uint256 constant BAG = 1_000_000e18;
    uint256 constant PRICE = 10 ether;

    function setUp() public {
        desk = new Desk(treasury);
        coin = new Coin();
        coin.mint(maker, BAG);
        coin.mint(taker, BAG);
        vm.deal(maker, 100 ether);
        vm.deal(taker, 100 ether);
        vm.deal(other, 100 ether);
        vm.prank(maker);
        coin.approve(address(desk), type(uint256).max);
        vm.prank(taker);
        coin.approve(address(desk), type(uint256).max);
    }

    function _exp() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _ask(uint256 minFill, address only) internal returns (uint256) {
        vm.prank(maker);
        return desk.postAsk(address(coin), BAG, PRICE, minFill, only, _exp());
    }

    function _bid(uint256 minFill, address only) internal returns (uint256) {
        vm.prank(maker);
        return desk.postBid{value: PRICE}(address(coin), BAG, minFill, only, _exp());
    }

    /* ---------------------------------- asks --------------------------------- */

    function test_ask_escrowsAndSettlesAtomically() public {
        uint256 id = _ask(BAG, address(0));
        assertEq(coin.balanceOf(address(desk)), BAG, "escrowed");

        (uint256 eth, uint256 fee) = desk.quote(id, BAG);
        assertEq(eth, PRICE);
        assertEq(fee, PRICE * 30 / 10_000);

        uint256 makerEth = maker.balance;
        vm.prank(taker);
        desk.takeAsk{value: eth + fee}(id, BAG);

        assertEq(coin.balanceOf(taker), 2 * BAG, "taker got the bag");
        assertEq(maker.balance, makerEth + PRICE, "maker got the full price");
        assertEq(treasury.balance, fee, "fee to treasury");
        assertEq(coin.balanceOf(address(desk)), 0);
        assertEq(address(desk).balance, 0, "desk keeps nothing");
        assertFalse(desk.offer(id).open);
        assertEq(desk.volume(), PRICE);
        assertEq(desk.fills(), 1);
    }

    function test_ask_wrongValueReverts() public {
        uint256 id = _ask(BAG, address(0));
        vm.prank(taker);
        vm.expectRevert(Desk.WrongValue.selector);
        desk.takeAsk{value: PRICE}(id, BAG); // fee missing
        vm.prank(taker);
        vm.expectRevert(Desk.WrongValue.selector);
        desk.takeAsk{value: PRICE * 2}(id, BAG);
    }

    function test_ask_cannotTakeABid() public {
        uint256 id = _bid(BAG, address(0));
        vm.prank(taker);
        vm.expectRevert(Desk.NotOpen.selector);
        desk.takeAsk{value: 1}(id, BAG);
    }

    function test_ask_refusesTaxToken() public {
        TaxCoin t = new TaxCoin();
        t.mint(maker, BAG);
        vm.startPrank(maker);
        t.approve(address(desk), BAG);
        vm.expectRevert(Desk.InexactTransfer.selector);
        desk.postAsk(address(t), BAG, PRICE, BAG, address(0), _exp());
        vm.stopPrank();
    }

    /* ---------------------------------- bids --------------------------------- */

    function test_bid_escrowsEthAndSettles() public {
        uint256 id = _bid(BAG, address(0));
        assertEq(address(desk).balance, PRICE);

        uint256 takerEth = taker.balance;
        uint256 makerCoin = coin.balanceOf(maker);
        vm.prank(taker);
        desk.takeBid(id, BAG);

        uint256 fee = PRICE * 30 / 10_000;
        assertEq(coin.balanceOf(maker), makerCoin + BAG, "maker got tokens");
        assertEq(taker.balance, takerEth + PRICE - fee, "taker paid minus fee");
        assertEq(treasury.balance, fee);
        assertEq(address(desk).balance, 0);
        assertEq(coin.balanceOf(address(desk)), 0, "tokens never sit on the desk");
    }

    function test_bid_refusesTaxToken() public {
        TaxCoin t = new TaxCoin();
        t.mint(taker, BAG);
        vm.prank(maker);
        uint256 id = desk.postBid{value: PRICE}(address(t), BAG, BAG, address(0), _exp());
        vm.startPrank(taker);
        t.approve(address(desk), BAG);
        vm.expectRevert(Desk.InexactTransfer.selector);
        desk.takeBid(id, BAG);
        vm.stopPrank();
    }

    function test_bid_withoutApprovalReverts() public {
        uint256 id = _bid(BAG, address(0));
        vm.prank(other); // holds nothing, approved nothing
        vm.expectRevert();
        desk.takeBid(id, BAG);
        assertEq(address(desk).balance, PRICE, "escrow intact");
    }

    /* ------------------------------ partial fills ---------------------------- */

    function test_partialFills_addUpToExactTotal() public {
        // A price that does not divide evenly.
        vm.prank(maker);
        uint256 id = desk.postAsk(address(coin), 3, 10, 1, address(0), _exp());
        uint256 paid;
        for (uint256 i; i < 3; i++) {
            (uint256 eth, uint256 fee) = desk.quote(id, 1);
            paid += eth;
            vm.prank(taker);
            desk.takeAsk{value: eth + fee}(id, 1);
        }
        assertEq(paid, 10, "fills add up to the total");
        assertFalse(desk.offer(id).open);
    }

    function test_partialFill_minFillEnforced() public {
        uint256 min = BAG / 10;
        uint256 id = _ask(min, address(0));
        (uint256 e, uint256 f) = desk.quote(id, min - 1);
        vm.prank(taker);
        vm.expectRevert(Desk.BadFill.selector);
        desk.takeAsk{value: e + f}(id, min - 1);

        // A fill that would strand a remainder under the minimum is refused.
        uint256 tooMuch = BAG - min + 1;
        (e, f) = desk.quote(id, tooMuch);
        vm.prank(taker);
        vm.expectRevert(Desk.BadFill.selector);
        desk.takeAsk{value: e + f}(id, tooMuch);

        // Half, then the rest.
        (e, f) = desk.quote(id, BAG / 2);
        vm.prank(taker);
        desk.takeAsk{value: e + f}(id, BAG / 2);
        assertTrue(desk.offer(id).open);
        (e, f) = desk.quote(id, BAG / 2);
        vm.prank(other);
        desk.takeAsk{value: e + f}(id, BAG / 2);
        assertFalse(desk.offer(id).open);
    }

    function test_partialBid_thenCancelRefundsRest() public {
        uint256 id = _bid(BAG / 4, address(0));
        vm.prank(taker);
        desk.takeBid(id, BAG / 4);
        uint256 before = maker.balance;
        vm.prank(maker);
        desk.cancel(id);
        assertEq(maker.balance - before, PRICE - PRICE / 4, "rest of the ETH back");
        assertEq(address(desk).balance, 0);
    }

    function test_overfillReverts() public {
        uint256 id = _ask(1, address(0));
        vm.prank(taker);
        vm.expectRevert(Desk.BadFill.selector);
        desk.takeAsk{value: 0}(id, BAG + 1);
        vm.prank(taker);
        vm.expectRevert(Desk.BadFill.selector);
        desk.takeAsk{value: 0}(id, 0);
    }

    /* ------------------------------ private offers --------------------------- */

    function test_private_onlyNamedTaker() public {
        uint256 id = _ask(BAG, taker);
        (uint256 e, uint256 f) = desk.quote(id, BAG);
        vm.prank(other);
        vm.expectRevert(Desk.NotTaker.selector);
        desk.takeAsk{value: e + f}(id, BAG);
        vm.prank(taker);
        desk.takeAsk{value: e + f}(id, BAG);
    }

    function test_private_bidOnlyNamedSeller() public {
        coin.mint(other, BAG);
        vm.prank(other);
        coin.approve(address(desk), BAG);
        uint256 id = _bid(BAG, taker);
        vm.prank(other);
        vm.expectRevert(Desk.NotTaker.selector);
        desk.takeBid(id, BAG);
    }

    function test_selfFillReverts() public {
        uint256 id = _ask(BAG, address(0));
        (uint256 e, uint256 f) = desk.quote(id, BAG);
        vm.prank(maker);
        vm.expectRevert(Desk.SelfFill.selector);
        desk.takeAsk{value: e + f}(id, BAG);

        vm.prank(maker);
        vm.expectRevert(Desk.SelfFill.selector);
        desk.postAsk(address(coin), 1, 1, 1, maker, _exp());
    }

    /* ------------------------------ cancel / expiry -------------------------- */

    function test_cancel_returnsBag() public {
        uint256 id = _ask(BAG, address(0));
        vm.prank(taker);
        vm.expectRevert(Desk.NotMaker.selector);
        desk.cancel(id);
        vm.prank(maker);
        desk.cancel(id);
        assertEq(coin.balanceOf(maker), BAG);
        vm.prank(maker);
        vm.expectRevert(Desk.NotOpen.selector);
        desk.cancel(id);
        vm.prank(taker);
        vm.expectRevert(Desk.NotOpen.selector);
        desk.takeAsk{value: 0}(id, BAG);
    }

    function test_expiry_blocksFillsAndReclaimGoesToMaker() public {
        uint256 id = _bid(BAG, address(0));
        vm.prank(other);
        vm.expectRevert(Desk.NotExpired.selector);
        desk.reclaim(id);

        vm.warp(block.timestamp + 1 days);
        vm.prank(taker);
        vm.expectRevert(Desk.Expired.selector);
        desk.takeBid(id, BAG);

        uint256 before = maker.balance;
        uint256 otherBefore = other.balance;
        vm.prank(other); // a stranger triggers it
        desk.reclaim(id);
        assertEq(maker.balance - before, PRICE, "maker refunded");
        assertEq(other.balance, otherBefore, "stranger gets nothing");
    }

    function test_badParamsRevert() public {
        vm.startPrank(maker);
        vm.expectRevert(Desk.ZeroAmount.selector);
        desk.postAsk(address(coin), 0, 1, 1, address(0), _exp());
        vm.expectRevert(Desk.ZeroAmount.selector);
        desk.postBid{value: 0}(address(coin), 1, 1, address(0), _exp());
        vm.expectRevert(Desk.BadMinFill.selector);
        desk.postAsk(address(coin), 10, 1, 0, address(0), _exp());
        vm.expectRevert(Desk.BadMinFill.selector);
        desk.postAsk(address(coin), 10, 1, 11, address(0), _exp());
        vm.expectRevert(Desk.BadExpiry.selector);
        desk.postAsk(address(coin), 10, 1, 1, address(0), uint64(block.timestamp));
        vm.expectRevert(Desk.BadExpiry.selector);
        desk.postAsk(address(coin), 10, 1, 1, address(0), uint64(block.timestamp + 31 days));
        vm.stopPrank();
    }

    /* ------------------------------- adversarial ----------------------------- */

    function test_makerRefusingEthBlocksOnlyItsOwnFill() public {
        NoEth bad = new NoEth();
        coin.mint(address(bad), BAG);
        vm.prank(address(bad));
        coin.approve(address(desk), BAG);
        vm.prank(address(bad));
        uint256 id = desk.postAsk(address(coin), BAG, PRICE, BAG, address(0), _exp());
        (uint256 e, uint256 f) = desk.quote(id, BAG);
        vm.prank(taker);
        vm.expectRevert(Desk.PayFailed.selector);
        desk.takeAsk{value: e + f}(id, BAG);
        assertEq(coin.balanceOf(address(desk)), BAG, "nothing moved");
    }

    function test_reentrancyFromPayoutBlocked() public {
        Reenterer r = new Reenterer(desk);
        vm.deal(address(r), PRICE);
        r.bid{value: PRICE}(address(coin), BAG);
        // Partial-free bid: the fill pays the taker, not the maker, so make the
        // reenterer cancel twice via its receive hook.
        vm.expectRevert(Desk.PayFailed.selector); // inner cancel hits nonReentrant
        r.cancel();
        assertEq(address(desk).balance, PRICE, "escrow intact");
    }

    function test_onlyAdminSetsTreasury() public {
        vm.prank(other);
        vm.expectRevert(Desk.NotAdmin.selector);
        desk.setTreasury(other);
        desk.setTreasury(other);
        assertEq(desk.treasury(), other);
    }

    function test_offersPage() public {
        _ask(BAG / 2, address(0));
        _bid(BAG, address(0));
        assertEq(desk.offerCount(), 2);
        Desk.Offer[] memory p = desk.offers(0, 10);
        assertEq(p.length, 2);
        assertEq(uint8(p[1].side), uint8(Desk.Side.Bid));
        assertEq(desk.offers(5, 10).length, 0);
    }

    /* ---------------------------------- fuzz --------------------------------- */

    function testFuzz_conservation(uint96 amount, uint96 total, uint96 first) public {
        vm.assume(amount > 1 && total > 0 && first > 0 && first < amount);
        coin.mint(maker, amount);
        vm.deal(taker, uint256(total) * 2);
        vm.prank(maker);
        uint256 id = desk.postAsk(address(coin), amount, total, 1, address(0), _exp());
        (uint256 e1, uint256 f1) = desk.quote(id, first);
        vm.prank(taker);
        desk.takeAsk{value: e1 + f1}(id, first);
        (uint256 e2, uint256 f2) = desk.quote(id, amount - first);
        vm.prank(taker);
        desk.takeAsk{value: e2 + f2}(id, amount - first);
        assertEq(e1 + e2, total, "exact total");
        assertEq(address(desk).balance, 0);
        assertEq(coin.balanceOf(address(desk)), 0);
    }
}
