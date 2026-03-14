import schedule from 'node-schedule';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
// TODO: Move to config file or env vars
const DAILY_TIME = '0 8 * * *'; // 8:00 AM daily
const WEEKLY_TIME = '0 8 * * 0'; // 8:00 AM Sunday

async function runCommand(command: string) {
  console.log(`[Scheduler] Running: ${command}`);
  try {
    // Explicitly use PowerShell on Windows to handle paths with spaces and environment variables correctly
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell' : undefined;
    
    const { stdout, stderr } = await execAsync(command, { shell });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`[Scheduler] Finished: ${command}`);
  } catch (error) {
    console.error(`[Scheduler] Error running ${command}:`, error);
    throw error; // Re-throw to stop the chain
  }
}

import { pushFeishuDaily } from '../services/notifier.ts';

// Task Status Management
export const taskStatus = {
    state: 'idle', // idle, running, success, error
    error: null as string | null,
    lastRun: null as string | null
};

export async function runDailyTask() {
    if (taskStatus.state === 'running') {
        console.log('[Scheduler] Daily task already running, skipping duplicate trigger.');
        return;
    }

    console.log('[Scheduler] Starting daily fetch (X)...');
    taskStatus.state = 'running';
    taskStatus.error = null;
    taskStatus.lastRun = new Date().toISOString();

    try {
        // Fetch X (past 1 day)
        await runCommand('python scripts/x-collector/main.py --days 1');
        // Seed
        await runCommand('npx tsx scripts/seed.ts');
        // Score
        await runCommand('npm run score');
        // Push Notification
        await pushFeishuDaily();
        
        console.log('[Scheduler] Daily fetch completed.');
        taskStatus.state = 'success';
    } catch (e: any) {
        console.error('[Scheduler] Daily fetch failed:', e);
        taskStatus.state = 'error';
        taskStatus.error = e.message || String(e);
    }
}

export async function runWeeklyTask() {
    console.log('[Scheduler] Starting weekly fetch (RSS)...');
    try {
        // Fetch RSS
        await runCommand('python scripts/fetch_rss.py --days 7');
        // Seed
        await runCommand('npx tsx scripts/seed.ts');
        // Score
        await runCommand('npm run score');
        console.log('[Scheduler] Weekly fetch completed.');
    } catch (e) {
        console.error('[Scheduler] Weekly fetch failed:', e);
    }
}

let dailyJob: schedule.Job | null = null;
let currentDailyTime = DAILY_TIME;

export function rescheduleDailyTask(newCron: string) {
  if (dailyJob) {
    dailyJob.cancel();
  }
  console.log(`[Scheduler] Rescheduling daily task to: ${newCron}`);
  dailyJob = schedule.scheduleJob(newCron, runDailyTask);
  currentDailyTime = newCron;
}

export function getScheduleConfig() {
  return { 
    dailyTime: currentDailyTime,
    pushLimit: Number(process.env.PUSH_LIMIT) || 10
  };
}

export function initScheduler() {
  console.log('[Scheduler] Initializing...');
  console.log(`[Scheduler] Daily task scheduled at: ${DAILY_TIME}`);
  console.log(`[Scheduler] Weekly task scheduled at: ${WEEKLY_TIME}`);

  // Daily: Fetch X (past 24h) -> Seed -> Score
  dailyJob = schedule.scheduleJob(DAILY_TIME, runDailyTask);

  // Weekly: Fetch RSS (past 7 days) -> Seed -> Score
  schedule.scheduleJob(WEEKLY_TIME, runWeeklyTask);
}
