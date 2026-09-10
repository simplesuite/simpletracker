// Store bridges use requestAnimationFrame to batch observable updates in the app.
// Core store tests assert the derived Zustand state immediately after a source
// write, so run the callback synchronously in the test environment.
globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(Date.now());
    return 0;
}) as typeof globalThis.requestAnimationFrame;

globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
