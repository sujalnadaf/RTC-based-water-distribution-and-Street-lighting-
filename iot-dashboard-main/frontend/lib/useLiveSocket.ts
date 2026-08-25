'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export interface DeviceStatus {
  tankLevelMl: number;
  flowRateLpm: number;

  ward1Ml: number;
  ward2Ml: number;
  ward3Ml: number;

  activeWard: number;

  streetLight: boolean;

  leakDetected: boolean;
  dryTank: boolean;

  timestamp: string;

  stale?: boolean;

  deviceOnline?: boolean;
  device_online?: boolean;
}


// ============================================================
// WEBSOCKET URL
// ============================================================

function buildWebSocketUrl() {
  let url =
    process.env.NEXT_PUBLIC_WS_URL?.trim();

  /*
   * If NEXT_PUBLIC_WS_URL is missing,
   * derive it from NEXT_PUBLIC_API_URL.
   */
  if (!url) {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL?.trim();

    if (apiUrl) {
      url = apiUrl;
    }
  }


  /*
   * Local fallback
   */
  if (!url) {
    return 'ws://localhost:5000/ws';
  }


  /*
   * Convert normal HTTP URL to WebSocket protocol.
   */
  if (url.startsWith('https://')) {
    url =
      'wss://' +
      url.substring('https://'.length);
  } else if (url.startsWith('http://')) {
    url =
      'ws://' +
      url.substring('http://'.length);
  }


  /*
   * Remove trailing slash.
   */
  while (url.endsWith('/')) {
    url =
      url.slice(0, -1);
  }


  /*
   * Backend WebSocket server is mounted at /ws.
   */
  if (!url.endsWith('/ws')) {
    url += '/ws';
  }


  return url;
}


const WS_URL =
  buildWebSocketUrl();


const RECONNECT_DELAY_MS =
  3000;

const ALERT_DEDUPLICATION_MS =
  10000;


// ============================================================
// HOOK
// ============================================================

export function useLiveSocket() {

  const [status, setStatus] =
    useState<DeviceStatus | null>(
      null
    );

  const [connected, setConnected] =
    useState(false);


  const socketRef =
    useRef<WebSocket | null>(
      null
    );


  const reconnectTimerRef =
    useRef<
      ReturnType<typeof setTimeout> | null
    >(null);


  const hardwareOfflineRef =
    useRef(false);


  const hasReceivedHardwareStateRef =
    useRef(false);


  const lastAlertRef =
    useRef<{
      message: string;
      shownAt: number;
    } | null>(null);


  // ==========================================================
  // EFFECT
  // ==========================================================

  useEffect(() => {

    let disposed =
      false;


    console.log(
      '[WebSocket] URL:',
      WS_URL
    );


    // ========================================================
    // CLEAR RECONNECT TIMER
    // ========================================================

    function clearReconnectTimer() {

      if (
        reconnectTimerRef.current
      ) {

        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current =
          null;
      }
    }


    // ========================================================
    // RECONNECT
    // ========================================================

    function scheduleReconnect() {

      if (
        disposed ||
        reconnectTimerRef.current
      ) {

        return;
      }


      console.log(
        `[WebSocket] Reconnecting in ${RECONNECT_DELAY_MS}ms...`
      );


      reconnectTimerRef.current =
        setTimeout(
          () => {

            reconnectTimerRef.current =
              null;


            if (!disposed) {
              connect();
            }

          },

          RECONNECT_DELAY_MS
        );
    }


    // ========================================================
    // HARDWARE OFFLINE
    // ========================================================

    function markHardwareOffline() {

      if (
        hardwareOfflineRef.current
      ) {

        return;
      }


      hardwareOfflineRef.current =
        true;


      hasReceivedHardwareStateRef.current =
        true;


      toast.error(
        'ESP32 hardware is offline. Showing the last known cloud data.',
        {
          id:
            'esp32-hardware-status',

          icon:
            '⚠️',

          duration:
            5000,
        }
      );
    }


    // ========================================================
    // HARDWARE ONLINE
    // ========================================================

    function markHardwareOnline() {

      const wasOffline =
        hardwareOfflineRef.current;


      hardwareOfflineRef.current =
        false;


      if (
        wasOffline &&
        hasReceivedHardwareStateRef.current
      ) {

        toast.success(
          'ESP32 connected. Live sensor data is available.',
          {
            id:
              'esp32-hardware-status',

            icon:
              '✅',

            duration:
              4000,
          }
        );
      }


      hasReceivedHardwareStateRef.current =
        true;
    }


    // ========================================================
    // ALERT DEDUPLICATION
    // ========================================================

    function showAlertOnce(
      message: string,
      severity?: string
    ) {

      const now =
        Date.now();


      const previousAlert =
        lastAlertRef.current;


      const repeated =
        previousAlert?.message ===
          message &&
        now -
          previousAlert.shownAt <
          ALERT_DEDUPLICATION_MS;


      if (repeated) {
        return;
      }


      lastAlertRef.current = {
        message,
        shownAt: now,
      };


      toast.error(
        message,
        {
          id:
            `device-alert-${message}`,

          icon:
            severity ===
            'critical'
              ? '🚨'
              : '⚠️',

          duration:
            5000,
        }
      );
    }


    // ========================================================
    // PROCESS DEVICE STATUS
    // ========================================================

    function processStatus(
      deviceStatus: DeviceStatus
    ) {

      const hardwareOnline =
        deviceStatus.deviceOnline ===
          true ||
        deviceStatus.device_online ===
          true;


      const correctedStatus:
        DeviceStatus = {

        ...deviceStatus,

        deviceOnline:
          hardwareOnline,

        device_online:
          hardwareOnline,
      };


      setStatus(
        correctedStatus
      );


      if (hardwareOnline) {

        markHardwareOnline();

      } else {

        markHardwareOffline();
      }
    }


    // ========================================================
    // CONNECT WEBSOCKET
    // ========================================================

    function connect() {

      if (disposed) {
        return;
      }


      const currentSocket =
        socketRef.current;


      if (
        currentSocket?.readyState ===
          WebSocket.OPEN ||
        currentSocket?.readyState ===
          WebSocket.CONNECTING
      ) {

        return;
      }


      clearReconnectTimer();


      console.log(
        '[WebSocket] Connecting:',
        WS_URL
      );


      let ws: WebSocket;


      try {

        ws =
          new WebSocket(
            WS_URL
          );

      } catch (error) {

        console.error(
          '[WebSocket] Creation failed:',
          error
        );


        setConnected(
          false
        );


        scheduleReconnect();

        return;
      }


      socketRef.current =
        ws;


      // ======================================================
      // OPEN
      // ======================================================

      ws.onopen = () => {

        if (disposed) {

          ws.close();

          return;
        }


        console.log(
          '[WebSocket] Connected'
        );


        setConnected(
          true
        );
      };


      // ======================================================
      // CLOSE
      // ======================================================

      ws.onclose =
        (event) => {

          console.warn(
            '[WebSocket] Closed:',
            event.code,
            event.reason
          );


          if (
            socketRef.current ===
            ws
          ) {

            socketRef.current =
              null;
          }


          if (disposed) {
            return;
          }


          setConnected(
            false
          );


          scheduleReconnect();
        };


      // ======================================================
      // ERROR
      // ======================================================

      ws.onerror = (
        event
      ) => {

        console.error(
          '[WebSocket] Error:',
          event
        );


        setConnected(
          false
        );


        /*
         * The close event performs
         * reconnection.
         */
        try {

          ws.close();

        } catch {
          // Ignore close errors.
        }
      };


      // ======================================================
      // MESSAGE
      // ======================================================

      ws.onmessage =
        (event) => {

          if (disposed) {
            return;
          }


          try {

            const msg =
              JSON.parse(
                event.data
              );


            // -----------------------------------------------
            // Initial backend connection frame
            // -----------------------------------------------

            if (
              msg.type ===
              'connected'
            ) {

              console.log(
                '[WebSocket]',
                msg.message
              );


              setConnected(
                true
              );

              return;
            }


            // -----------------------------------------------
            // Live ESP32 status
            // -----------------------------------------------

            if (
              msg.type ===
                'status' &&
              msg.data
            ) {

              processStatus(
                msg.data as
                  DeviceStatus
              );

              return;
            }


            // -----------------------------------------------
            // Alert
            // -----------------------------------------------

            if (
              msg.type ===
                'alert' &&
              msg.message
            ) {

              showAlertOnce(
                msg.message,
                msg.severity
              );

              return;
            }


            // -----------------------------------------------
            // ESP32 offline
            // -----------------------------------------------

            if (
              msg.type ===
              'device_offline'
            ) {

              markHardwareOffline();

              return;
            }


            // -----------------------------------------------
            // ESP32 recovered
            // -----------------------------------------------

            if (
              msg.type ===
                'device_online' ||
              msg.type ===
                'device_connected'
            ) {

              markHardwareOnline();

              return;
            }

          } catch (error) {

            console.error(
              '[WebSocket] Invalid message:',
              error
            );
          }
        };
    }


    // ========================================================
    // START
    // ========================================================

    connect();


    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {

      disposed =
        true;


      clearReconnectTimer();


      const socket =
        socketRef.current;


      socketRef.current =
        null;


      if (socket) {

        socket.onopen =
          null;

        socket.onmessage =
          null;

        socket.onerror =
          null;

        socket.onclose =
          null;


        try {

          socket.close();

        } catch {
          // Ignore shutdown errors.
        }
      }
    };

  }, []);


  return {
    status,
    connected,
  };
}