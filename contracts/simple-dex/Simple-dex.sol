// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract SimpleDEX is ERC20 {
    using SafeERC20 for IERC20;

    address public immutable token0;
    address public immutable token1;
    uint256 public reserve0;
    uint256 public reserve1;

    uint256 private constant MINIMUM_LIQUIDITY = 10**3;
    uint256 private unlocked = 1;
    uint256 private constant FEE_DENOMINATOR = 1000;
    uint256 private constant FEE_NUMERATOR = 3; // 0.3% fee

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed tokenIn, address indexed tokenOut, address to);

    constructor(address _token0, address _token1) ERC20("SimpleDEX LP Token", "SDEX-LP") {
        require(_token0 != address(0) && _token1 != address(0), "SimpleDEX: ZERO_ADDRESS");
        require(_token0 != _token1, "SimpleDEX: IDENTICAL_ADDRESSES");
        token0 = _token0;
        token1 = _token1;
    }

    modifier lock() {
        require(unlocked == 1, 'SimpleDEX: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function _update() private {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }

    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) external lock returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        require(to != address(0), "SimpleDEX: INVALID_TO");
        (amount0, amount1) = _addLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
        
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        liquidity = _mintLiquidity(to, amount0, amount1);

        _update();
        emit Mint(msg.sender, amount0, amount1);
    }

    function removeLiquidity(uint256 liquidity, uint256 amount0Min, uint256 amount1Min, address to) external lock returns (uint256 amount0, uint256 amount1) {
        require(to != address(0), "SimpleDEX: INVALID_TO");
        (amount0, amount1) = _burnLiquidity(msg.sender, to, liquidity);
        require(amount0 >= amount0Min, 'SimpleDEX: INSUFFICIENT_A_AMOUNT');
        require(amount1 >= amount1Min, 'SimpleDEX: INSUFFICIENT_B_AMOUNT');

        _update();
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to
    ) external lock returns (uint256 amountOut) {
        require(tokenIn == token0 || tokenIn == token1, "SimpleDEX: INVALID_TOKEN");
        address tokenOut = tokenIn == token0 ? token1 : token0;
        require(to != address(0), "SimpleDEX: INVALID_TO");

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        
        amountOut = _getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "SimpleDEX: INSUFFICIENT_OUTPUT_AMOUNT");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        _update();
        emit Swap(msg.sender, amountIn, amountOut, tokenIn, tokenOut, to);
        
        return amountOut;
    }

    function _addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) internal view returns (uint256 amount0, uint256 amount1) {
        if (reserve0 == 0 && reserve1 == 0) {
            (amount0, amount1) = (amount0Desired, amount1Desired);
        } else {
            uint256 amount1Optimal = (amount0Desired * reserve1) / reserve0;
            if (amount1Optimal <= amount1Desired) {
                require(amount1Optimal >= amount1Min, 'SimpleDEX: INSUFFICIENT_B_AMOUNT');
                (amount0, amount1) = (amount0Desired, amount1Optimal);
            } else {
                uint256 amount0Optimal = (amount1Desired * reserve0) / reserve1;
                assert(amount0Optimal <= amount0Desired);
                require(amount0Optimal >= amount0Min, 'SimpleDEX: INSUFFICIENT_A_AMOUNT');
                (amount0, amount1) = (amount0Optimal, amount1Desired);
            }
        }
    }

    function _mintLiquidity(address to, uint256 amount0, uint256 amount1) internal returns (uint256 liquidity) {
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(
                (amount0 * _totalSupply) / reserve0,
                (amount1 * _totalSupply) / reserve1
            );
        }

        require(liquidity > 0, 'SimpleDEX: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);
    }

    function _burnLiquidity(address from, address to, uint256 liquidity) internal returns (uint256 amount0, uint256 amount1) {
        uint256 _totalSupply = totalSupply();

        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, 'SimpleDEX: INSUFFICIENT_LIQUIDITY_BURNED');

        _burn(from, liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, 'SimpleDEX: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'SimpleDEX: INSUFFICIENT_LIQUIDITY');
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        require(tokenIn == token0 || tokenIn == token1, "SimpleDEX: INVALID_TOKEN");
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return _getAmountOut(amountIn, reserveIn, reserveOut);
    }
}