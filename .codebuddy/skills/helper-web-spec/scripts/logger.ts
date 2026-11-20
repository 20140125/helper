#!/usr/bin/env node

/**
 * 日志工具模块
 * 为代码生成脚本提供统一的日志输出格式
 */

enum LogLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(color: string, text: string): string {
  return `${color}${text}${colors.reset}`;
}

export function logInfo(message: string): void {
  console.log(colorize(colors.cyan, 'ℹ'), message);
}

export function logSuccess(message: string): void {
  console.log(colorize(colors.green, '✅'), message);
}

export function logWarning(message: string): void {
  console.log(colorize(colors.yellow, '⚠️ '), message);
}

export function logError(message: string): void {
  console.error(colorize(colors.red, '❌'), message);
}

export function logStep(step: number, total: number, message: string): void {
  console.log(colorize(colors.gray, `[${step}/${total}]`), message);
}
