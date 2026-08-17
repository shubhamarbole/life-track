import { Capacitor } from '@capacitor/core';

let Health = null;
if (Capacitor.isNativePlatform()) {
  import('@capgo/capacitor-health').then(module => {
    Health = module.Health;
  }).catch(err => {
    console.error('Failed to dynamically import @capgo/capacitor-health:', err);
  });
}

export const isNativeApp = () => {
  return Capacitor.isNativePlatform();
};

export const requestHealthAuth = async () => {
  if (!isNativeApp() || !Health) {
    throw new Error('Native health tracking is only supported inside the iOS/Android mobile app wrapper.');
  }

  try {
    const status = await Health.requestAuthorization({
      read: ['steps'],
      write: [],
      requestHistoryAccess: true
    });
    return status;
  } catch (err) {
    console.error('Health permission request error:', err);
    throw err;
  }
};

export const checkHealthAuth = async () => {
  if (!isNativeApp() || !Health) return false;
  try {
    const res = await Health.checkAuthorization({
      read: ['steps'],
      write: []
    });
    // Check if steps read permission is granted in scope
    return res && res.steps === true;
  } catch (err) {
    console.error('Check authorization error:', err);
    return false;
  }
};

export const getDailyStepsData = async (daysCount = 7) => {
  if (!isNativeApp() || !Health) return [];
  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000);
    
    const result = await Health.queryAggregated({
      dataType: 'steps',
      startDate,
      endDate,
      bucket: 'day'
    });

    return result.samples || [];
  } catch (err) {
    console.error('Error querying aggregated steps:', err);
    throw err;
  }
};
