#!/bin/bash
# ─── Dhun ADB Reverse Keep-Alive Daemon ─────────────────────────────────
# Automatically ensures port 5001 is reversed whenever an Android phone is attached.

export PATH=$PATH:$HOME/Library/Android/sdk/platform-tools

while true; do
  # Check for physical phone
  if adb get-state 2>/dev/null | grep -q "device"; then
    for dev in $(adb devices | grep -w "device" | awk '{print $1}'); do
      if ! adb -s "$dev" reverse --list 2>/dev/null | grep -q "tcp:5001"; then
        adb -s "$dev" reverse tcp:5001 tcp:5001 2>/dev/null
      fi
    done
  fi
  sleep 3
done
