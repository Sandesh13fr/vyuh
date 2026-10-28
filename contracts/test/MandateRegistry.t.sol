// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "./Fixture.sol";
import {Mandate, Unauthorized, InvalidSignature, InvalidVersion, NotTighter} from "../src/types/VyuhTypes.sol";

contract MandateRegistryTest is Fixture {
    event MandateSet(address indexed vault, bytes32 mandateHash, uint64 version, bool tightenedByAgent);

    function test_storesOwnerSignedMandate() public view {
        Mandate memory m = mandates.getMandate(address(vault));
        assertEq(m.owner, owner);
        assertEq(m.agent, agent);
        assertEq(m.version, 1);
        assertEq(m.allowedTokens.length, 2);
    }

    function test_rejectsWrongSigner() public {
        Mandate memory m = _mandate(2);
        bytes memory sig = _sign(0xBAD, m);
        vm.prank(owner);
        vm.expectRevert(InvalidSignature.selector);
        mandates.setMandate(address(vault), m, sig);
    }

    function test_rejectsTamperedMandate() public {
        Mandate memory m = _mandate(2);
        bytes memory sig = _sign(OWNER_PK, m);
        m.maxTradeUsd = 1_000_000e18; // agent swaps in a looser cap after the owner signed
        vm.prank(agent);
        vm.expectRevert(InvalidSignature.selector);
        mandates.setMandate(address(vault), m, sig);
    }

    function test_strangerCannotRelay() public {
        Mandate memory m = _mandate(2);
        bytes memory sig = _sign(OWNER_PK, m);
        vm.prank(stranger);
        vm.expectRevert(Unauthorized.selector);
        mandates.setMandate(address(vault), m, sig);
    }

    function test_versionMustIncrease() public {
        Mandate memory m = _mandate(1);
        bytes memory sig = _sign(OWNER_PK, m);
        vm.prank(owner);
        vm.expectRevert(InvalidVersion.selector);
        mandates.setMandate(address(vault), m, sig);
        _setMandate(_mandate(7));
        assertEq(mandates.getMandate(address(vault)).version, 7);
    }

    function test_agentCanTighten() public {
        Mandate memory m = _mandate(2);
        m.maxTradeUsd = 500e18;
        m.cooldownSecs = 120;
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdt);
        m.allowedTokens = tokens;
        bytes32 h = mandates.hashMandate(m);
        vm.expectEmit(address(mandates));
        emit MandateSet(address(vault), h, 2, true);
        vm.prank(agent);
        mandates.tighten(address(vault), m);
        assertEq(mandates.getMandate(address(vault)).maxTradeUsd, 500e18);
    }

    function test_agentCannotLoosen() public {
        Mandate memory m = _mandate(2);
        m.maxTradeUsd = 2_000e18;
        vm.prank(agent);
        vm.expectRevert(NotTighter.selector);
        mandates.tighten(address(vault), m);

        m = _mandate(2);
        m.cooldownSecs = 0;
        vm.prank(agent);
        vm.expectRevert(NotTighter.selector);
        mandates.tighten(address(vault), m);

        m = _mandate(2);
        address[] memory tokens = new address[](3);
        tokens[0] = address(usdt);
        tokens[1] = address(whsk);
        tokens[2] = address(evil);
        m.allowedTokens = tokens;
        vm.prank(agent);
        vm.expectRevert(NotTighter.selector);
        mandates.tighten(address(vault), m);
    }

    function test_onlyAgentTightens() public {
        Mandate memory m = _mandate(2);
        m.maxTradeUsd = 1e18;
        vm.prank(stranger);
        vm.expectRevert(Unauthorized.selector);
        mandates.tighten(address(vault), m);
    }

    function test_ownerLoosensWithFreshSignature() public {
        Mandate memory m = _mandate(2);
        m.maxTradeUsd = 2_000e18;
        _setMandate(m);
        assertEq(mandates.getMandate(address(vault)).maxTradeUsd, 2_000e18);
    }
}
