#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <RTClib.h>

RTC_DS3231 rtc;
WebServer server(80);


// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID = "S";
const char* WIFI_PASS = "92949294";


// =====================================================
// PIN CONFIGURATION
// =====================================================

#define LDR_PIN          27
#define STREET_LED_PIN   14

#define RELAY_WARD1      25
#define RELAY_WARD2      26
#define RELAY_WARD3      33

#define FLOW_SENSOR_PIN  32


// Relay board is ACTIVE LOW
#define RELAY_ON   LOW
#define RELAY_OFF  HIGH


// =====================================================
// WATER CONFIGURATION
// =====================================================

const float TANK_CAPACITY_ML = 5000.0;

// Your calibrated YF-S201 value
const float FLOW_CALIBRATION = 255.0;   // pulses per liter


// =====================================================
// SYSTEM STATE
// =====================================================

bool ward1Open = false;
bool ward2Open = false;
bool ward3Open = false;

int activeWard = 0;


// =====================================================
// STREET LIGHT STATE
// =====================================================

bool streetLightOn = false;

String lightMode = "auto";


// =====================================================
// WATER STATE
// =====================================================

volatile unsigned long flowPulseCount = 0;

unsigned long lastFlowUpdate = 0;

float flowRate = 0.0;

float tankLevelMl = TANK_CAPACITY_ML;

float ward1Ml = 0.0;
float ward2Ml = 0.0;
float ward3Ml = 0.0;

bool leakDetected = false;
bool dryTank = false;


// =====================================================
// FLOW SENSOR INTERRUPT
// =====================================================

void IRAM_ATTR flowPulseCounter() {

  flowPulseCount++;

}


// =====================================================
// APPLY RELAY STATES
// =====================================================

void applyRelays() {

  digitalWrite(
    RELAY_WARD1,
    ward1Open ? RELAY_ON : RELAY_OFF
  );

  digitalWrite(
    RELAY_WARD2,
    ward2Open ? RELAY_ON : RELAY_OFF
  );

  digitalWrite(
    RELAY_WARD3,
    ward3Open ? RELAY_ON : RELAY_OFF
  );


  if (ward1Open) {

    activeWard = 1;

  }

  else if (ward2Open) {

    activeWard = 2;

  }

  else if (ward3Open) {

    activeWard = 3;

  }

  else {

    activeWard = 0;

  }
}


// =====================================================
// LDR / STREET LIGHT LOGIC
// =====================================================

void updateLight() {

  int ldrState =
    digitalRead(LDR_PIN);


  /*
     Your actual tested LDR behavior:

     HIGH = DARK
     LOW  = LIGHT
  */


  if (lightMode == "auto") {

    if (ldrState == HIGH) {

      // DARK
      streetLightOn = true;

      digitalWrite(
        STREET_LED_PIN,
        HIGH
      );

    }

    else {

      // LIGHT
      streetLightOn = false;

      digitalWrite(
        STREET_LED_PIN,
        LOW
      );

    }
  }


  else if (lightMode == "on") {

    streetLightOn = true;

    digitalWrite(
      STREET_LED_PIN,
      HIGH
    );

  }


  else if (lightMode == "off") {

    streetLightOn = false;

    digitalWrite(
      STREET_LED_PIN,
      LOW
    );

  }
}


// =====================================================
// FLOW SENSOR + WATER DISTRIBUTION
// =====================================================

void updateFlowSensor() {

  unsigned long currentTime =
    millis();


  if (
    currentTime - lastFlowUpdate >= 1000
  ) {

    unsigned long elapsedTime =
      currentTime - lastFlowUpdate;


    // ---------------------------------------------
    // Safely read pulse counter
    // ---------------------------------------------

    noInterrupts();

    unsigned long pulses =
      flowPulseCount;

    flowPulseCount = 0;

    interrupts();


    // ---------------------------------------------
    // Convert pulses to liters
    //
    // liters = pulses / pulses-per-liter
    // ---------------------------------------------

    float litersThisCycle =
      pulses / FLOW_CALIBRATION;


    float waterMl =
      litersThisCycle * 1000.0;


    // ---------------------------------------------
    // Calculate L/min
    // ---------------------------------------------

    flowRate =
      litersThisCycle *
      (60000.0 / elapsedTime);


    // ---------------------------------------------
    // Spike / noise filter
    // ---------------------------------------------

    if (
      flowRate < 0.0 ||
      flowRate >= 30.0
    ) {

      flowRate = 0.0;

      waterMl = 0.0;

    }


    // =================================================
    // REAL WATER DETECTED
    // =================================================

    if (waterMl > 0.0) {


      // ---------------------------------------------
      // Flow while no ward is open = possible leak
      // ---------------------------------------------

      if (activeWard == 0) {

        leakDetected = true;

      }

      else {

        leakDetected = false;


        // ---------------------------------------------
        // Assign water to current active ward
        // ---------------------------------------------

        if (activeWard == 1) {

          ward1Ml += waterMl;

        }


        else if (activeWard == 2) {

          ward2Ml += waterMl;

        }


        else if (activeWard == 3) {

          ward3Ml += waterMl;

        }


        // ---------------------------------------------
        // Virtual tank-level estimation
        // ---------------------------------------------

        tankLevelMl -= waterMl;


        if (tankLevelMl < 0.0) {

          tankLevelMl = 0.0;

        }

      }
    }


    else {

      // No flow currently
      leakDetected = false;

    }


    // =================================================
    // DRY TANK PROTECTION
    // =================================================

    if (tankLevelMl <= 0.0) {

      dryTank = true;


      // Close all valves
      ward1Open = false;
      ward2Open = false;
      ward3Open = false;


      applyRelays();

    }

    else {

      dryTank = false;

    }


    // =================================================
    // SERIAL DEBUG
    // =================================================

    Serial.print(
      "Pulses: "
    );

    Serial.print(
      pulses
    );


    Serial.print(
      " | Flow: "
    );

    Serial.print(
      flowRate,
      2
    );

    Serial.print(
      " L/min"
    );


    Serial.print(
      " | Water: "
    );

    Serial.print(
      waterMl,
      1
    );

    Serial.print(
      " mL"
    );


    Serial.print(
      " | Ward: "
    );

    Serial.print(
      activeWard
    );


    Serial.print(
      " | W1: "
    );

    Serial.print(
      ward1Ml,
      1
    );


    Serial.print(
      " | W2: "
    );

    Serial.print(
      ward2Ml,
      1
    );


    Serial.print(
      " | W3: "
    );

    Serial.print(
      ward3Ml,
      1
    );


    Serial.print(
      " | Tank: "
    );

    Serial.print(
      tankLevelMl,
      1
    );

    Serial.print(
      " mL"
    );


    if (leakDetected) {

      Serial.print(
        " | LEAK DETECTED"
      );

    }


    if (dryTank) {

      Serial.print(
        " | DRY TANK"
      );

    }


    Serial.println();


    lastFlowUpdate =
      currentTime;

  }
}


// =====================================================
// SIMPLE JSON WARD EXTRACTION
// =====================================================

int extractWardFromBody(
  String body
) {

  if (
    body.indexOf("\"ward\":1") >= 0 ||
    body.indexOf("\"ward\": 1") >= 0 ||
    body.indexOf("\"w\":1") >= 0 ||
    body.indexOf("\"w\": 1") >= 0
  ) {

    return 1;

  }


  if (
    body.indexOf("\"ward\":2") >= 0 ||
    body.indexOf("\"ward\": 2") >= 0 ||
    body.indexOf("\"w\":2") >= 0 ||
    body.indexOf("\"w\": 2") >= 0
  ) {

    return 2;

  }


  if (
    body.indexOf("\"ward\":3") >= 0 ||
    body.indexOf("\"ward\": 3") >= 0 ||
    body.indexOf("\"w\":3") >= 0 ||
    body.indexOf("\"w\": 3") >= 0
  ) {

    return 3;

  }


  return 0;
}


// =====================================================
// GET /status
// =====================================================

void handleStatus() {

  updateLight();

  DateTime now =
    rtc.now();


  String json = "{";


  // =================================================
  // CURRENT DASHBOARD FIELD NAMES
  // =================================================

  json += "\"tankLevel\":";
  json += String(tankLevelMl, 0);
  json += ",";


  json += "\"flowRate\":";
  json += String(flowRate, 2);
  json += ",";


  json += "\"ward1\":";
  json += String(ward1Ml, 0);
  json += ",";


  json += "\"ward2\":";
  json += String(ward2Ml, 0);
  json += ",";


  json += "\"ward3\":";
  json += String(ward3Ml, 0);
  json += ",";


  json += "\"activeWard\":";
  json += String(activeWard);
  json += ",";


  json += "\"streetLight\":";

  json +=
    streetLightOn
      ? "true"
      : "false";

  json += ",";


  json += "\"lightMode\":\"";
  json += lightMode;
  json += "\",";


  // =================================================
  // OLD BACKEND ALIASES
  // =================================================

  json += "\"tank\":";
  json += String(tankLevelMl, 0);
  json += ",";


  json += "\"flow\":";
  json += String(flowRate, 2);
  json += ",";


  json += "\"w1\":";
  json += String(ward1Ml, 0);
  json += ",";


  json += "\"w2\":";
  json += String(ward2Ml, 0);
  json += ",";


  json += "\"w3\":";
  json += String(ward3Ml, 0);
  json += ",";


  json += "\"ward\":";
  json += String(activeWard);
  json += ",";


  json += "\"light\":";

  json +=
    streetLightOn
      ? "true"
      : "false";

  json += ",";


  // =================================================
  // ALERT STATUS
  // =================================================

  json += "\"leakDetected\":";

  json +=
    leakDetected
      ? "true"
      : "false";

  json += ",";


  json += "\"dryTank\":";

  json +=
    dryTank
      ? "true"
      : "false";

  json += ",";


  // Old aliases

  json += "\"leak\":";

  json +=
    leakDetected
      ? "true"
      : "false";

  json += ",";


  json += "\"dry\":";

  json +=
    dryTank
      ? "true"
      : "false";

  json += ",";


  // =================================================
  // RTC
  // =================================================

  json += "\"rtc\":\"";


  if (now.hour() < 10)
    json += "0";

  json +=
    String(now.hour());


  json += ":";


  if (now.minute() < 10)
    json += "0";

  json +=
    String(now.minute());


  json += ":";


  if (now.second() < 10)
    json += "0";

  json +=
    String(now.second());


  json += "\"";


  json += "}";


  server.send(
    200,
    "application/json",
    json
  );
}


// =====================================================
// VALVE CONTROL
// =====================================================

void handleValve() {

  int ward = 0;

  String state = "";


  Serial.println();

  Serial.println(
    "========== VALVE REQUEST =========="
  );


  Serial.print(
    "Arguments received: "
  );

  Serial.println(
    server.args()
  );


  for (
    int i = 0;
    i < server.args();
    i++
  ) {

    Serial.print(
      server.argName(i)
    );

    Serial.print(
      " = "
    );

    Serial.println(
      server.arg(i)
    );

  }


  // =================================================
  // QUERY PARAMETERS
  // =================================================

  if (
    server.hasArg("ward")
  ) {

    ward =
      server.arg("ward").toInt();

  }


  if (
    ward == 0 &&
    server.hasArg("w")
  ) {

    ward =
      server.arg("w").toInt();

  }


  if (
    server.hasArg("state")
  ) {

    state =
      server.arg("state");

  }


  if (
    state == "" &&
    server.hasArg("action")
  ) {

    state =
      server.arg("action");

  }


  if (
    state == "" &&
    server.hasArg("open")
  ) {

    state =
      server.arg("open");

  }


  // =================================================
  // JSON POST BODY
  // =================================================

  if (
    server.hasArg("plain")
  ) {

    String body =
      server.arg("plain");


    Serial.print(
      "JSON BODY: "
    );

    Serial.println(
      body
    );


    if (ward == 0) {

      ward =
        extractWardFromBody(
          body
        );

    }


    if (
      body.indexOf("\"action\":\"open\"") >= 0 ||
      body.indexOf("\"action\": \"open\"") >= 0 ||
      body.indexOf("\"state\":\"open\"") >= 0 ||
      body.indexOf("\"state\": \"open\"") >= 0 ||
      body.indexOf("\"state\":true") >= 0 ||
      body.indexOf("\"state\": true") >= 0 ||
      body.indexOf("\"open\":true") >= 0 ||
      body.indexOf("\"open\": true") >= 0
    ) {

      state = "open";

    }


    if (
      body.indexOf("\"action\":\"close\"") >= 0 ||
      body.indexOf("\"action\": \"close\"") >= 0 ||
      body.indexOf("\"state\":\"close\"") >= 0 ||
      body.indexOf("\"state\": \"close\"") >= 0 ||
      body.indexOf("\"state\":false") >= 0 ||
      body.indexOf("\"state\": false") >= 0 ||
      body.indexOf("\"open\":false") >= 0 ||
      body.indexOf("\"open\": false") >= 0
    ) {

      state = "close";

    }
  }


  state.toLowerCase();


  bool openValve = false;


  if (
    state == "open" ||
    state == "on" ||
    state == "1" ||
    state == "true"
  ) {

    openValve = true;

  }


  if (
    state == "close" ||
    state == "off" ||
    state == "0" ||
    state == "false"
  ) {

    openValve = false;

  }


  Serial.print(
    "WARD COMMAND -> "
  );

  Serial.print(
    ward
  );

  Serial.print(
    " | "
  );

  Serial.println(
    openValve
      ? "OPEN"
      : "CLOSE"
  );


  // =================================================
  // VALIDATE WARD
  // =================================================

  if (
    ward < 1 ||
    ward > 3
  ) {

    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"Invalid ward\"}"
    );

    return;

  }


  // =================================================
  // DON'T OPEN IF TANK IS EMPTY
  // =================================================

  if (
    openValve &&
    dryTank
  ) {

    server.send(
      409,
      "application/json",
      "{\"success\":false,\"error\":\"Tank is empty\"}"
    );

    return;

  }


  // =================================================
  // ONLY ONE WARD OPEN AT A TIME
  // =================================================

  if (openValve) {

    ward1Open = false;
    ward2Open = false;
    ward3Open = false;

  }


  if (ward == 1) {

    ward1Open =
      openValve;

  }


  else if (ward == 2) {

    ward2Open =
      openValve;

  }


  else if (ward == 3) {

    ward3Open =
      openValve;

  }


  applyRelays();


  Serial.print(
    "ACTIVE WARD = "
  );

  Serial.println(
    activeWard
  );


  Serial.println(
    "RELAY COMMAND SUCCESS"
  );


  String response = "{";

  response +=
    "\"success\":true,";

  response +=
    "\"ward\":" +
    String(ward) +
    ",";

  response +=
    "\"open\":";

  response +=
    openValve
      ? "true"
      : "false";

  response += "}";


  server.send(
    200,
    "application/json",
    response
  );
}


// =====================================================
// STREET LIGHT CONTROL
// =====================================================

void handleLight() {

  String state = "";


  Serial.println();

  Serial.println(
    "========== LIGHT REQUEST =========="
  );


  if (
    server.hasArg("state")
  ) {

    state =
      server.arg("state");

  }


  if (
    state == "" &&
    server.hasArg("action")
  ) {

    state =
      server.arg("action");

  }


  if (
    server.hasArg("plain")
  ) {

    String body =
      server.arg("plain");


    Serial.print(
      "LIGHT BODY: "
    );

    Serial.println(
      body
    );


    if (
      body.indexOf("\"auto\"") >= 0
    ) {

      state = "auto";

    }


    else if (
      body.indexOf("\"on\"") >= 0
    ) {

      state = "on";

    }


    else if (
      body.indexOf("\"off\"") >= 0
    ) {

      state = "off";

    }

  }


  state.toLowerCase();


  // Also accept old 1/0 format
  if (state == "1") {

    state = "on";

  }


  if (state == "0") {

    state = "off";

  }


  if (state == "on") {

    lightMode = "on";

  }


  else if (state == "off") {

    lightMode = "off";

  }


  else {

    lightMode = "auto";

  }


  updateLight();


  Serial.print(
    "LIGHT MODE = "
  );

  Serial.println(
    lightMode
  );


  Serial.print(
    "STREET LIGHT STATUS = "
  );

  Serial.println(
    streetLightOn
      ? "ON"
      : "OFF"
  );


  server.send(
    200,
    "application/json",
    "{\"success\":true}"
  );
}


// =====================================================
// REFILL / RESET TANK
// =====================================================

void handleRefill() {

  tankLevelMl =
    TANK_CAPACITY_ML;


  ward1Ml =
    0.0;

  ward2Ml =
    0.0;

  ward3Ml =
    0.0;


  flowRate =
    0.0;


  leakDetected =
    false;


  dryTank =
    false;


  Serial.println(
    "TANK REFILLED TO 5000 mL"
  );


  server.send(
    200,
    "application/json",
    "{\"success\":true}"
  );
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(
    115200
  );


  delay(
    1000
  );


  Serial.println();

  Serial.println(
    "========================================"
  );

  Serial.println(
    " RTC WATER DISTRIBUTION + STREET LIGHT"
  );

  Serial.println(
    "========================================"
  );


  // =================================================
  // RELAYS
  // =================================================

  pinMode(
    RELAY_WARD1,
    OUTPUT
  );

  pinMode(
    RELAY_WARD2,
    OUTPUT
  );

  pinMode(
    RELAY_WARD3,
    OUTPUT
  );


  digitalWrite(
    RELAY_WARD1,
    RELAY_OFF
  );

  digitalWrite(
    RELAY_WARD2,
    RELAY_OFF
  );

  digitalWrite(
    RELAY_WARD3,
    RELAY_OFF
  );


  Serial.println(
    "Relay module initialized"
  );


  // =================================================
  // LDR + STREET LIGHT LED
  // =================================================

  pinMode(
    LDR_PIN,
    INPUT
  );


  pinMode(
    STREET_LED_PIN,
    OUTPUT
  );


  digitalWrite(
    STREET_LED_PIN,
    LOW
  );


  Serial.println(
    "LDR and street-light LED initialized"
  );


  // =================================================
  // FLOW SENSOR
  // =================================================

  pinMode(
    FLOW_SENSOR_PIN,
    INPUT_PULLUP
  );


  attachInterrupt(
    digitalPinToInterrupt(
      FLOW_SENSOR_PIN
    ),
    flowPulseCounter,
    FALLING
  );


  lastFlowUpdate =
    millis();


  Serial.println(
    "YF-S201 initialized"
  );

  Serial.println(
    "Calibration = 255 pulses/liter"
  );


  // =================================================
  // RTC
  // =================================================

  Wire.begin(
    21,
    22
  );


  if (
    !rtc.begin()
  ) {

    Serial.println(
      "RTC ERROR"
    );


    while (1) {

      delay(
        1000
      );

    }

  }


  Serial.println(
    "RTC connected"
  );


  // =================================================
  // WIFI
  // =================================================

  Serial.print(
    "Connecting WiFi"
  );


  WiFi.begin(
    WIFI_SSID,
    WIFI_PASS
  );


  while (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.print(
      "."
    );

    delay(
      500
    );

  }


  Serial.println();


  Serial.println(
    "WiFi connected"
  );


  Serial.print(
    "ESP32 IP: "
  );


  Serial.println(
    WiFi.localIP()
  );


  // =================================================
  // HTTP ROUTES
  // =================================================

  server.on(
    "/status",
    HTTP_GET,
    handleStatus
  );


  server.on(
    "/valve",
    HTTP_POST,
    handleValve
  );

  server.on(
    "/valve",
    HTTP_GET,
    handleValve
  );


  server.on(
    "/light",
    HTTP_POST,
    handleLight
  );

  server.on(
    "/light",
    HTTP_GET,
    handleLight
  );


  server.on(
    "/refill",
    HTTP_POST,
    handleRefill
  );

  server.on(
    "/refill",
    HTTP_GET,
    handleRefill
  );


  server.begin();


  Serial.println(
    "ESP32 HTTP server started"
  );


  Serial.println(
    "========================================"
  );
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  server.handleClient();

  updateLight();

  updateFlowSensor();

  delay(
    5
  );
}