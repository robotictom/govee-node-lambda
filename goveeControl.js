#!/usr/bin/env node

/**
 * Usage (CLI):
 *   GOVEE_API_KEY=your_key \
 *   GOVEE_DEVICE_ID=your_device_id \
 *   GOVEE_DEVICE_MODEL=your_device_model \
 *   node goveeControl.js --event set_color --hex "#FF0000"
 *
 * AWS Lambda:
 *   handler({ event: 'set_color', hex: 'FF0000' })
 */

require('dotenv').config();
const axios = require('axios');
const { program } = require('commander');
const { randomUUID } = require('crypto');

const API_KEY = process.env.GOVEE_API_KEY;
const DEVICE_ID = process.env.GOVEE_DEVICE_ID;
const DEVICE_MODEL = process.env.GOVEE_DEVICE_MODEL;
let BASE_COLOR = process.env.BASE_COLOR;

if (!BASE_COLOR) {
    BASE_COLOR = 'FFFFFF';
}

const BASE_URL = 'https://openapi.api.govee.com/router/api/v1';

if (!API_KEY) {
    console.error('Error: GOVEE_API_KEY environment variable is required.');
    process.exit(1);
}
if (!DEVICE_ID) {
    console.error('Error: GOVEE_DEVICE_ID environment variable is required.');
    process.exit(1);
}
if (!DEVICE_MODEL) {
    console.error('Error: GOVEE_DEVICE_MODEL environment variable is required.');
    process.exit(1);
}

const headers = {
    'Content-Type': 'application/json',
    'Govee-API-Key': API_KEY,
};

async function getDeviceState() {
    const body = {
        requestId: randomUUID(),
        payload: { sku: DEVICE_MODEL, device: DEVICE_ID },
    };
    const resp = await axios.post(`${BASE_URL}/device/state`, body, { headers });
    return resp.data.payload.capabilities;
}

async function controlDevice(capability) {
    const body = {
        requestId: randomUUID(),
        payload: { sku: DEVICE_MODEL, device: DEVICE_ID, capability },
    };
    await axios.post(`${BASE_URL}/device/control`, body, { headers });
}

async function turnOn() {
    await controlDevice({
        type: 'devices.capabilities.on_off',
        instance: 'powerSwitch',
        value: 1,
    });
}

async function turnOff() {
    await controlDevice({
        type: 'devices.capabilities.on_off',
        instance: 'powerSwitch',
        value: 0,
    });
}

async function setColorCode(rgb) {
    await controlDevice({
        type: 'devices.capabilities.color_setting',
        instance: 'colorRgb',
        value: rgb,
    });
}

async function setColorRGB(r, g, b) {
    const rgb = ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
    await controlDevice({
        type: 'devices.capabilities.color_setting',
        instance: 'colorRgb',
        value: rgb,
    });
}

function hexToRgb(hex) {
    const clean = hex.replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    const intVal = parseInt(clean, 16);
    const r = (intVal >> 16) & 0xff;
    const g = (intVal >> 8) & 0xff;
    const b = intVal & 0xff;
    return [r, g, b];
}

async function flash(hex, currentColor, durationMs = 3000, intervalMs = 500) {
    console.log(`Flash Start: ${hex}`);
    const [r, g, b] = hexToRgb(hex);
    const cycles = Math.floor(durationMs / (intervalMs * 2));
    for (let i = 0; i < cycles; i++) {
        await turnOn();
        await setColorRGB(r, g, b);
        await new Promise((res) => setTimeout(res, intervalMs));
        await turnOff();
        await new Promise((res) => setTimeout(res, intervalMs));
    }
    await turnOn();
    await setColorCode(currentColor);
    console.log('Flash Complete');
}

async function resetColor() {
    await turnOn();
    const [r, g, b] = hexToRgb(BASE_COLOR);
    await setColorRGB(r, g, b);
    console.log(`Setting color to hex ${BASE_COLOR} -> RGB(${r},${g},${b})`);
}

async function handleEvent(eventType, opts) {
    const caps = await getDeviceState();
    const powerCap = caps.find((c) => c.type === 'devices.capabilities.on_off' && c.instance === 'powerSwitch');
    const isOn = powerCap?.state?.value === 1;
    const colorCap = caps.find((c) => c.type === 'devices.capabilities.color_setting' && c.instance === 'colorRgb');
    const currentColor = colorCap?.state?.value;

    switch (eventType) {
        case 'turn_on':
            await turnOn();
            console.log('Light turned on');
            break;

        case 'turn_off':
            await turnOff();
            console.log('Light turned off');
            break;

        case 'flash':
            let hex = !opts.hex ? BASE_COLOR : opts.hex;
            await flash(hex, currentColor);
            break;

        case 'reset':
            await resetColor();
            break;

        case 'set_color':
            if (!opts.hex) {
                throw new Error("Missing '--hex' parameter for set_color event.");
            }
            if (!isOn && opts.preventOverride) {
                console.log("Light is off and '--prevent-override' flag is set; no action taken.");
                return;
            }
            if (!isOn) {
                console.log('Light is off; turning on first...');
                await turnOn();
            }
            const [r, g, b] = hexToRgb(opts.hex);
            console.log(`Setting color to hex ${opts.hex} → RGB(${r},${g},${b})`);
            await setColorRGB(r, g, b);
            console.log('Color applied.');
            break;

        default:
            throw new Error(`Unknown event: ${eventType}`);
    }
}

program
    .requiredOption('-e, --event <type>', 'Event: turn_on, turn_off, flash, reset, set_color')
    .option('--prevent-override', 'Prevent turning on if off')
    .option('--hex <hex>', 'Hex color code (#RRGGBB or RRGGBB)')
    .action((opts) => {
        const ev = opts.event.toLowerCase();
        handleEvent(ev, {
            preventOverride: opts.preventOverride,
            hex: opts.hex,
        }).catch((err) => {
            console.error('Error:', err.message);
            process.exit(1);
        });
    });

if (require.main === module) {
    program.parse();
}

// AWS Lambda handler
exports.handler = async (lambdaEvent) => {
    const ev = (lambdaEvent.event || '').toLowerCase();
    try {
        await handleEvent(ev, {
            preventOverride: Boolean(lambdaEvent.preventOverride),
            hex: lambdaEvent.hex,
        });
        return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };
    } catch (err) {
        console.error('Lambda error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
