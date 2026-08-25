const cron = require('node-cron');
const { pool } = require('../config/db');
const esp32 = require('../services/esp32.service');

const DEVICE_ID = 1;

const DAY_CODES = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
];

// Keeps track of what state scheduler last commanded
const lastWardState = new Map();


// =====================================================
// GET CURRENT INDIA TIME
// =====================================================

function getIndiaTime() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday =
    parts.find((p) => p.type === 'weekday')?.value
      ?.toUpperCase()
      .slice(0, 3);

  const hour =
    parts.find((p) => p.type === 'hour')?.value || '00';

  const minute =
    parts.find((p) => p.type === 'minute')?.value || '00';

  return {
    today: weekday,
    hhmm: `${hour}:${minute}`,
  };
}


// =====================================================
// CHECK WHETHER CURRENT TIME IS INSIDE SCHEDULE
// =====================================================

function isTimeInsideWindow(current, start, end) {

  // Normal schedule:
  // 13:30 -> 14:30

  if (start < end) {
    return current >= start && current < end;
  }

  // Overnight schedule:
  // 23:30 -> 01:00

  if (start > end) {
    return current >= start || current < end;
  }

  // Same start/end means invalid/zero-duration schedule
  return false;
}


// =====================================================
// START SCHEDULER
// =====================================================

function startScheduler() {

  cron.schedule(
    '* * * * *',

    async () => {

      try {

        const {
          today,
          hhmm,
        } = getIndiaTime();


        console.log(
          `[Scheduler] Checking ${today} ${hhmm}`
        );


        // =================================================
        // LOAD ACTIVE SCHEDULES
        // =================================================

        const [schedules] =
          await pool.query(
            `
            SELECT *
            FROM schedules
            WHERE device_id = ?
              AND is_active = TRUE
            `,
            [DEVICE_ID]
          );


        console.log(
          `[Scheduler] Active schedules found: ${schedules.length}`
        );


        // =================================================
        // PROCESS EACH SCHEDULE
        // =================================================

        for (const s of schedules) {

          // -----------------------------------------------
          // Parse days
          // -----------------------------------------------

          const days = String(
            s.days_mask || ''
          )
            .split(',')
            .map((d) => d.trim().toUpperCase())
            .filter(Boolean);


          console.log(
            `[Scheduler] Ward ${s.ward_number} | ` +
            `Days=${days.join(',')} | ` +
            `Start=${s.start_time} | ` +
            `End=${s.end_time}`
          );


          // -----------------------------------------------
          // Skip if not scheduled today
          // -----------------------------------------------

          if (
            days.length > 0 &&
            !days.includes(today)
          ) {

            console.log(
              `[Scheduler] Ward ${s.ward_number} skipped - not scheduled for ${today}`
            );

            continue;
          }


          // -----------------------------------------------
          // Normalize database TIME values
          // -----------------------------------------------

          const start =
            String(s.start_time)
              .slice(0, 5);

          const end =
            String(s.end_time)
              .slice(0, 5);


          // -----------------------------------------------
          // Determine desired valve state
          // -----------------------------------------------

          const shouldBeOpen =
            isTimeInsideWindow(
              hhmm,
              start,
              end
            );


          const ward =
            Number(s.ward_number);


          const previousState =
            lastWardState.get(ward);


          console.log(
            `[Scheduler] Ward ${ward} | ` +
            `Now=${hhmm} | ` +
            `Window=${start}-${end} | ` +
            `Desired=${shouldBeOpen ? 'OPEN' : 'CLOSED'}`
          );


          // =================================================
          // ONLY SEND COMMAND WHEN STATE NEEDS TO CHANGE
          // =================================================

          if (
            previousState === shouldBeOpen
          ) {

            continue;
          }


          // =================================================
          // OPEN
          // =================================================

          if (shouldBeOpen) {

            console.log(
              `[Scheduler] Opening Ward ${ward}...`
            );


            try {

              await esp32.setValve(
                ward,
                true
              );


              lastWardState.set(
                ward,
                true
              );


              console.log(
                `[Scheduler] SUCCESS: Ward ${ward} OPENED`
              );

            } catch (error) {

              console.error(
                `[Scheduler] FAILED to open Ward ${ward}:`,
                error.message
              );
            }

          }


          // =================================================
          // CLOSE
          // =================================================

          else {

            // On first discovery outside its active window,
            // send CLOSE once to establish a safe state.

            console.log(
              `[Scheduler] Closing Ward ${ward}...`
            );


            try {

              await esp32.setValve(
                ward,
                false
              );


              lastWardState.set(
                ward,
                false
              );


              console.log(
                `[Scheduler] SUCCESS: Ward ${ward} CLOSED`
              );

            } catch (error) {

              console.error(
                `[Scheduler] FAILED to close Ward ${ward}:`,
                error.message
              );
            }
          }
        }

      } catch (err) {

        console.error(
          '[Scheduler] Error evaluating schedules:',
          err
        );
      }

    },

    {
      timezone: 'Asia/Kolkata',
    }
  );


  console.log(
    '[Scheduler] Water distribution scheduler started.'
  );

  console.log(
    '[Scheduler] Timezone: Asia/Kolkata'
  );

  console.log(
    '[Scheduler] Checking every minute.'
  );
}


module.exports = {
  startScheduler,
};