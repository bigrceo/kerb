// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Desk} from "../src/Desk.sol";

/// A plain ERC-20 for the testnet desk, all of it minted to the deployer.
contract DemoCoin is ERC20 {
    constructor(address to) ERC20("Kerb Demo Coin", "KDEMO") {
        _mint(to, 1_000_000_000e18);
    }
}

/// forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast
/// env: PRIVATE_KEY, TREASURY (defaults to the deployer), DEMO_COIN=true on testnet
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("TREASURY", vm.addr(pk));
        vm.startBroadcast(pk);
        Desk desk = new Desk(treasury);
        if (vm.envOr("DEMO_COIN", false)) console.log("demo coin", address(new DemoCoin(vm.addr(pk))));
        vm.stopBroadcast();
        console.log("desk", address(desk));
    }
}
