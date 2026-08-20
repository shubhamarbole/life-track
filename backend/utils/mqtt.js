import mqtt from 'mqtt';
import { logger } from './logger.js';
import DailyActivity from '../models/DailyActivity.js';
import AgentActivity from '../models/AgentActivity.js';
import User from '../models/User.js';

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || 'lifetrack';

let client = null;

export const connectMQTT = () => {
  try {
    client = mqtt.connect(brokerUrl, {
      clientId: `lifetrack_server_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 1000,
    });

    client.on('connect', () => {
      logger.success(`MQTT Connected to broker: ${brokerUrl}`);
      // Subscribe to wild card activity updates: prefix/userId/activity/update
      const topicPattern = `${topicPrefix}/+/activity/update`;
      client.subscribe(topicPattern, (err) => {
        if (!err) {
          logger.info(`MQTT Subscribed to topic: ${topicPattern}`);
        } else {
          logger.error(`MQTT Subscription Error: ${err.message}`);
        }
      });
    });

    client.on('message', async (topic, message) => {
      try {
        const payloadStr = message.toString();
        logger.info(`MQTT Received message on [${topic}]: ${payloadStr}`);

        // Topic format: prefix/userId/activity/update
        const parts = topic.split('/');
        if (parts.length < 4) return;
        
        const userId = parts[1];
        const payload = JSON.parse(payloadStr);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
          logger.warn(`MQTT User not found for ID: ${userId}`);
          return;
        }

        const todayStr = payload.date || new Date().toISOString().split('T')[0];

        let activity = await DailyActivity.findOne({ userId, date: todayStr });
        if (!activity) {
          activity = new DailyActivity({
            userId,
            date: todayStr,
            steps: payload.steps || 0,
            walkingDistance: payload.walkingDistance || 0,
            walkingDuration: payload.walkingDuration || 0,
            activityEvents: []
          });
        } else {
          if (payload.steps !== undefined) activity.steps = payload.steps;
          if (payload.walkingDistance !== undefined) activity.walkingDistance = payload.walkingDistance;
          if (payload.walkingDuration !== undefined) activity.walkingDuration = payload.walkingDuration;
        }

        if (payload.activityType) {
          activity.activityEvents.push({
            activityType: payload.activityType,
            timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
          });
        }

        await activity.save();
        logger.success(`MQTT Updated daily activity database successfully for user: ${user.name || userId}`);

        // Log to AgentActivity
        await AgentActivity.create({
          userId,
          action: 'mqtt_sync',
          details: `Synced steps: ${payload.steps || 0}, distance: ${payload.walkingDistance || 0}km via MQTT broker.`
        });

      } catch (err) {
        logger.error(`MQTT Message Process Error: ${err.message}`);
      }
    });

    client.on('error', (err) => {
      logger.error(`MQTT Broker Error: ${err.message}`);
    });

  } catch (err) {
    logger.error(`MQTT Initialization Error: ${err.message}`);
  }
};

export const publishAgentEvent = (userId, action, details) => {
  if (!client || !client.connected) {
    logger.warn('MQTT Client not connected. Cannot publish.');
    return;
  }
  try {
    const topic = `${topicPrefix}/${userId}/events`;
    const payload = JSON.stringify({
      action,
      details,
      timestamp: new Date()
    });
    client.publish(topic, payload, { qos: 1 });
    logger.info(`MQTT Published agent event to [${topic}]`);
  } catch (err) {
    logger.error(`MQTT Publish Error: ${err.message}`);
  }
};
