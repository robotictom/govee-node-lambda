# Govee Light Control CLI & Lambda

A lightweight Node.js script to control your Govee smart lights via the Govee Developer API.  
Supports local CLI usage on macOS/Linux or AWS Lambda deployment.

---

## Features

-   **turn_on** / **turn_off** — power the light on or off (does not change color)
-   **flash** — flash the light using a base color or provided hex, then restore previous color
-   **reset** — set the light to a soft white (or your configured BASE_COLOR)
-   **set_color** — set the light to any hex color (`#RRGGBB` or `RRGGBB`)
-   **--prevent-override** — (for `set_color`) skip powering on if the light is off
-   Reads API key, device ID, model SKU, and optional BASE_COLOR from environment variables

---

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Installation](#installation)
-   [Configuration](#configuration)
-   [Usage](#usage)
    -   [CLI Examples](#cli-examples)
    -   [AWS Lambda Deployment](#aws-lambda-deployment)
-   [Events & Flags](#events--flags)
-   [Contributing](#contributing)
-   [License](#license)

---

## Prerequisites

-   Node.js v14 or higher
-   A Govee Developer API key (sign up at https://developer.govee.com)
-   One or more Govee light devices and their **Device ID** & **Model SKU**

---

## Installation

1. **Clone the repository**
    ```bash
    git clone https://github.com/robotictom/govee-light-control.git
    cd govee-light-control
    ```

````

2. **Install dependencies**

   ```bash
   npm install axios commander dotenv
   ```

---

## Configuration

Create a `.env` file in the project root with the following variables:

```ini
# .env
GOVEE_API_KEY=your_govee_api_key
GOVEE_DEVICE_ID=AA:BB:CC:DD:EE:FF
GOVEE_DEVICE_MODEL=H605C

# Optional: base flash/reset color if no --hex is provided
# Must be 6-digit hex without "#"
BASE_COLOR=FFDDAA
```

* **GOVEE\_API\_KEY** — your Govee Developer API key
* **GOVEE\_DEVICE\_ID** — the target device’s unique ID
* **GOVEE\_DEVICE\_MODEL** — the target device’s SKU/model code
* **BASE\_COLOR** (optional) — fallback hex color for `flash`/`reset`; defaults to `FFFFFF`

---

## Usage

### CLI Examples

```bash
# Turn the light on (no color change)
node goveeControl.js --event turn_on

# Turn the light off
node goveeControl.js --event turn_off

# Flash the light for 3 seconds using BASE_COLOR
node goveeControl.js --event flash

# Flash using a custom hex color
node goveeControl.js --event flash --hex "#FF00FF"

# Reset the light to white (or your BASE_COLOR)
node goveeControl.js --event reset

# Set the light to solid red, powering on if necessary
node goveeControl.js --event set_color --hex FF0000

# Set the light to green, but do not turn on if currently off
node goveeControl.js --event set_color --hex 00FF00 --prevent-override
```

### AWS Lambda Deployment

1. **Bundle** your code and dependencies:

   ```bash
   zip -r function.zip goveeControl.js node_modules package.json
   ```

2. **Create** a new Lambda function (Node.js 14.x or higher).

3. **Upload** `function.zip` to the Lambda console.

4. **Set** environment variables in Lambda configuration:

   * `GOVEE_API_KEY`
   * `GOVEE_DEVICE_ID`
   * `GOVEE_DEVICE_MODEL`
   * (Optional) `BASE_COLOR`

5. **Handler**:

   ```
   goveeControl.handler
   ```

6. **Test** with a payload:

   ```json
   { "event": "flash", "hex": "00FF00" }
   ```

---

## Events & Flags

| Event       | Description                                                                                                | Flags                               |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `turn_on`   | Power the light on (retains last color)                                                                    | N/A                                 |
| `turn_off`  | Power the light off                                                                                        | N/A                                 |
| `flash`     | Flash light for 3 seconds (500 ms on/off cycles) then restore previous color. Uses `--hex` or `BASE_COLOR` | `--hex <hex>`                       |
| `reset`     | Power on & set to `BASE_COLOR` (or default white)                                                          | N/A                                 |
| `set_color` | Set solid color via `--hex` (powers on unless `--prevent-override` is set)                                 | `--hex <hex>`, `--prevent-override` |

* **`--hex <hex>`** — specify a hex color string (`#RRGGBB` or `RRGGBB`).
* **`--prevent-override`** — for `set_color`, skip powering on if light is off.

---

## License

MIT
````
