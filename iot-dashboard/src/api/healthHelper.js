// frontend/src/api/healthHelper.js
export async function getHealthWithFix(originalGetHealth) {
    const response = await originalGetHealth();
    
    // Transform the response to match what dashboard expects
    return {
        ...response,
        mqtt: {
            connected: response?.services?.mqtt?.connected || response?.mqtt?.connected || false
        },
        database: {
            connected: response?.services?.database?.connected || response?.database?.connected || false
        }
    };
}