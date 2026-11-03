// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Desk} from "../src/Desk.sol";

interface ICurve {
    function getReserves() external view returns (uint256 quoteReserve, uint256 tokenReserve);
}

interface IPonsFactory {
    struct Launched {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        address pairToken;
        uint256 graduationThreshold;
        uint24 poolFee;
        int24 tickSpacing;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        uint8 phase;
        bool exists;
    }
}

/// FORK=1 forge test --match-contract Fork --fork-url https://robinhood-rpc.publicnode.com
/// A whole bag of a live Pons coin changes hands on the desk; the coin's curve does not move.
contract ForkTest is Test {
    address constant PONS = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant COIN = 0x038b67eAc66d8F7D93ea2Fb7250be34cf2459D67;

    function test_fork_bagChangesHandsCurveStill() public {
        if (!vm.envOr("FORK", false)) return;
        (bool ok, bytes memory ret) =
            PONS.staticcall(abi.encodeWithSignature("getLaunchedToken(address)", COIN));
        require(ok, "launch read");
        IPonsFactory.Launched memory l = abi.decode(ret, (IPonsFactory.Launched));
        ICurve curve = ICurve(l.curve);
        (uint256 q0, uint256 t0) = curve.getReserves();

        Desk desk = new Desk(makeAddr("treasury"));
        address whale = makeAddr("whale");
        address buyer = makeAddr("buyer");
        uint256 bag = IERC20(COIN).totalSupply() / 50; // 2% of supply
        deal(COIN, whale, bag);
        vm.deal(buyer, 10 ether);

        vm.startPrank(whale);
        IERC20(COIN).approve(address(desk), bag);
        uint256 id = desk.postAsk(COIN, bag, 1 ether, bag, buyer, uint64(block.timestamp + 1 hours));
        vm.stopPrank();
        (uint256 eth, uint256 fee) = desk.quote(id, bag);
        vm.prank(buyer);
        desk.takeAsk{value: eth + fee}(id, bag);

        assertEq(IERC20(COIN).balanceOf(buyer), bag);
        assertEq(whale.balance, 1 ether);
        (uint256 q1, uint256 t1) = curve.getReserves();
        assertEq(q1, q0, "curve quote reserve untouched");
        assertEq(t1, t0, "curve token reserve untouched");
    }
}
