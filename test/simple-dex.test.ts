import { expect } from "chai";
import { ethers } from "hardhat";
import { SimpleDEX, TestERC20Token } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleDEX", function () {
    let dex: SimpleDEX;
    let tokenA: TestERC20Token;
    let tokenB: TestERC20Token;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;

    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const INITIAL_LIQUIDITY = ethers.parseEther("1000");

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const TestERC20Token = await ethers.getContractFactory(
            "TestERC20Token"
        );
        tokenA = await TestERC20Token.deploy("Token A", "TKA", INITIAL_SUPPLY);
        tokenB = await TestERC20Token.deploy("Token B", "TKB", INITIAL_SUPPLY);

        const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
        dex = await SimpleDEX.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );

        // Approve DEX to spend tokens
        await tokenA.approve(await dex.getAddress(), INITIAL_SUPPLY);
        await tokenB.approve(await dex.getAddress(), INITIAL_SUPPLY);
    });

    describe("Deployment", function () {
        it("Should set the correct token addresses", async function () {
            expect(await dex.token0()).to.equal(await tokenA.getAddress());
            expect(await dex.token1()).to.equal(await tokenB.getAddress());
        });

        it("Should have the correct name and symbol", async function () {
            expect(await dex.name()).to.equal("SimpleDEX LP Token");
            expect(await dex.symbol()).to.equal("SDEX-LP");
        });
    });

    describe("Adding Liquidity", function () {
        it("Should add initial liquidity correctly", async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );

            expect(await dex.reserve0()).to.equal(INITIAL_LIQUIDITY);
            expect(await dex.reserve1()).to.equal(INITIAL_LIQUIDITY);

            const expectedLiquidity = INITIAL_LIQUIDITY - BigInt(1000); // Subtracting MINIMUM_LIQUIDITY
            expect(await dex.balanceOf(owner.address)).to.equal(
                expectedLiquidity
            );
        });

        it("Should add subsequent liquidity proportionally", async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );

            const additionalLiquidity = ethers.parseEther("500");
            await dex.addLiquidity(
                additionalLiquidity,
                additionalLiquidity,
                0,
                0,
                owner.address
            );

            expect(await dex.reserve0()).to.equal(
                INITIAL_LIQUIDITY + additionalLiquidity
            );
            expect(await dex.reserve1()).to.equal(
                INITIAL_LIQUIDITY + additionalLiquidity
            );
        });

        it("Should fail when adding liquidity below minimum", async function () {
            await expect(
                dex.addLiquidity(1000, 1000, 0, 0, owner.address)
            ).to.be.revertedWith("SimpleDEX: INSUFFICIENT_LIQUIDITY_MINTED");
        });

        it("Should add liquidity with non 1:1 ratio correctly", async function () {
            const amount0 = ethers.parseEther("1000");
            const amount1 = ethers.parseEther("2000");

            await dex.addLiquidity(amount0, amount1, 0, 0, owner.address);

            expect(await dex.reserve0()).to.equal(amount0);
            expect(await dex.reserve1()).to.equal(amount1);

            const expectedLiquidity = ethers.parseEther(
                "1414.213562373095047801"
            ); // √(1000 * 2000) - 1000
            const actualLiquidity = await dex.balanceOf(owner.address);

            // Use closeTo for floating point comparison
            expect(actualLiquidity).to.be.closeTo(
                expectedLiquidity,
                ethers.parseEther("0.000000000000000001")
            );

            // Add more liquidity with the same ratio
            await dex.addLiquidity(
                amount0 / BigInt(2),
                amount1 / BigInt(2),
                0,
                0,
                owner.address
            );

            expect(await dex.reserve0()).to.equal(
                amount0 + amount0 / BigInt(2)
            );
            expect(await dex.reserve1()).to.equal(
                amount1 + amount1 / BigInt(2)
            );

            const newTotalLiquidity = await dex.totalSupply();
            const expectedNewLiquidity =
                expectedLiquidity + expectedLiquidity / BigInt(2);

            console.log(
                "expectedNewLiquidity: ",
                expectedNewLiquidity.toString()
            );

            expect(newTotalLiquidity).to.equal("2121320343559642573201");
        });

        it("Should fail when adding liquidity with incorrect ratio", async function () {
            const amount0 = ethers.parseEther("1000");
            const amount1 = ethers.parseEther("2000");

            await dex.addLiquidity(amount0, amount1, 0, 0, owner.address);

            // Try to add liquidity with incorrect ratio
            await expect(
                dex.addLiquidity(
                    amount0,
                    amount1 / BigInt(2),
                    amount0,
                    amount1 / BigInt(2),
                    owner.address
                )
            ).to.be.revertedWith("SimpleDEX: INSUFFICIENT_A_AMOUNT");

            await expect(
                dex.addLiquidity(
                    amount0 / BigInt(2),
                    amount1,
                    amount0 / BigInt(2),
                    amount1,
                    owner.address
                )
            ).to.be.revertedWith("SimpleDEX: INSUFFICIENT_B_AMOUNT");
        });
    });

    describe("Removing Liquidity", function () {
        beforeEach(async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );
        });

        it("Should remove liquidity correctly", async function () {
            const liquidityToRemove = await dex.balanceOf(owner.address);
            await dex.removeLiquidity(liquidityToRemove, 0, 0, owner.address);

            expect(await dex.reserve0()).to.equal(1000); // MINIMUM_LIQUIDITY
            expect(await dex.reserve1()).to.equal(1000); // MINIMUM_LIQUIDITY
            expect(await dex.balanceOf(owner.address)).to.equal(0);
        });

        it("Should fail when removing more liquidity than owned", async function () {
            const liquidityToRemove =
                (await dex.balanceOf(owner.address)) + BigInt(1);
            await expect(
                dex.removeLiquidity(liquidityToRemove, 0, 0, owner.address)
            ).to.be.reverted;
        });
    });

    describe("Swapping", function () {
        beforeEach(async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );
        });

        it("Should swap tokens correctly", async function () {
            const amountIn = ethers.parseEther("10");
            const expectedAmountOut = await dex.getAmountOut(
                amountIn,
                await tokenA.getAddress()
            );

            await dex.swapExactTokensForTokens(
                amountIn,
                0,
                await tokenA.getAddress(),
                addr1.address
            );

            expect(await tokenB.balanceOf(addr1.address)).to.equal(
                expectedAmountOut
            );
        });

        it("Should fail when expected output amount exceeds actual output amount", async function () {
            const amountIn = ethers.parseEther("10");
            const expectedAmountOut = await dex.getAmountOut(
                amountIn,
                await tokenA.getAddress()
            );

            await expect(
                dex.swapExactTokensForTokens(
                    amountIn,
                    expectedAmountOut + BigInt(1),
                    await tokenA.getAddress(),
                    addr1.address
                )
            ).to.be.revertedWith("SimpleDEX: INSUFFICIENT_OUTPUT_AMOUNT");
        });

        it("Should update reserves after swap", async function () {
            const amountIn = ethers.parseEther("10");
            const initialReserve0 = await dex.reserve0();
            const initialReserve1 = await dex.reserve1();

            await dex.swapExactTokensForTokens(
                amountIn,
                0,
                await tokenA.getAddress(),
                addr1.address
            );

            expect(await dex.reserve0()).to.be.gt(initialReserve0);
            expect(await dex.reserve1()).to.be.lt(initialReserve1);
        });
    });

    describe("Fee Collection", function () {
        it("Should collect fees on swaps", async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );

            const amountIn = ethers.parseEther("1000");
            await dex.swapExactTokensForTokens(
                amountIn,
                0,
                await tokenA.getAddress(),
                addr1.address
            );

            const reserve0 = await dex.reserve0();
            const reserve1 = await dex.reserve1();

            // The product of reserves should increase due to the fee
            expect(reserve0 * reserve1).to.be.gt(
                INITIAL_LIQUIDITY * INITIAL_LIQUIDITY
            );
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero liquidity edge case", async function () {
            const smallAmount = 1000; // Smaller than MINIMUM_LIQUIDITY
            await expect(
                dex.addLiquidity(smallAmount, smallAmount, 0, 0, owner.address)
            ).to.be.revertedWith("SimpleDEX: INSUFFICIENT_LIQUIDITY_MINTED");
        });

        it("Should prevent removing all liquidity", async function () {
            await dex.addLiquidity(
                INITIAL_LIQUIDITY,
                INITIAL_LIQUIDITY,
                0,
                0,
                owner.address
            );

            // Try to remove all liquidity
            await expect(
                dex.removeLiquidity(INITIAL_LIQUIDITY, 0, 0, owner.address)
            ).to.be.reverted;

            // Should be able to remove all but MINIMUM_LIQUIDITY
            // as the MINIMUM_LIQUIDITY (1000) has been burned to prevent zero liquidity
            await dex.removeLiquidity(
                INITIAL_LIQUIDITY - BigInt(1000),
                0,
                0,
                owner.address
            );
            expect(await dex.totalSupply()).to.equal(1000);
        });
    });
});
