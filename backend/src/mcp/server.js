'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const TOOLS = [
  {
    name: 'list_monitors',
    description: 'List all monitors with their current status. Optionally filter by status or category.',
    inputSchema: {
      type: 'object',
      properties: {
        status:   { type: 'string', enum: ['online', 'offline', 'warning', 'error', 'unknown'], description: 'Filter by status' },
        category: { type: 'string', description: 'Filter by category name' },
        enabled:  { type: 'boolean', description: 'Filter by enabled state' },
      },
    },
  },
  {
    name: 'get_monitor',
    description: 'Get full details and current metrics for a specific monitor, identified by its ID or exact name.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Monitor ID (MongoDB ObjectId) or exact name' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_incidents',
    description: 'List recent incidents, optionally filtered to open (unresolved) ones or a specific monitor.',
    inputSchema: {
      type: 'object',
      properties: {
        open_only:  { type: 'boolean', description: 'Only return unresolved incidents' },
        monitor_id: { type: 'string',  description: 'Filter by monitor ID' },
        limit:      { type: 'number',  description: 'Max number of results (default 10, max 100)' },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Get global monitoring statistics: total monitors and counts per status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'trigger_check',
    description: 'Trigger an immediate check for a monitor without waiting for the next scheduled interval.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Monitor ID to trigger' },
      },
      required: ['id'],
    },
  },
];

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

function createServer() {
  const server = new Server(
    { name: 'notifhub', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const Monitor = require('../models/Monitor');
    const monitors = await Monitor.find({}, 'name').sort({ position: 1, name: 1 }).lean();
    const names = monitors.map(m => m.name);

    const tools = TOOLS.map(tool => {
      if (tool.name === 'get_monitor' || tool.name === 'trigger_check') {
        return {
          ...tool,
          inputSchema: {
            ...tool.inputSchema,
            properties: {
              ...tool.inputSchema.properties,
              id: {
                ...tool.inputSchema.properties.id,
                enum: names,
                description: `Monitor name. Available: ${names.join(', ')}`,
              },
            },
          },
        };
      }
      return tool;
    });

    return { tools };
  });

  // Resource template: notifhub://monitors/{name}
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: 'notifhub://monitors/{name}',
        name: 'Monitor by name',
        description: 'Current status and metrics for a specific monitor. Use the exact service name.',
        mimeType: 'application/json',
      },
    ],
  }));

  // List all monitors as resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const Monitor = require('../models/Monitor');
    const monitors = await Monitor.find().sort({ position: 1, name: 1 }).lean();
    return {
      resources: monitors.map(m => ({
        uri:         `notifhub://monitors/${encodeURIComponent(m.name)}`,
        name:        m.name,
        description: `[${m.type}] ${m.enabled ? m.status : 'disabled'}${m.description ? ' — ' + m.description : ''}`,
        mimeType:    'application/json',
      })),
    };
  });

  // Read a monitor resource by URI
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const { uri } = req.params;
    const match = uri.match(/^notifhub:\/\/monitors\/(.+)$/);
    if (!match) throw new Error(`Unknown resource URI: ${uri}`);

    const name = decodeURIComponent(match[1]);
    const Monitor        = require('../models/Monitor');
    const MetricSnapshot = require('../models/MetricSnapshot');
    const mongoose       = require('mongoose');

    let monitor = null;
    if (mongoose.Types.ObjectId.isValid(name)) monitor = await Monitor.findById(name).lean();
    if (!monitor) monitor = await Monitor.findOne({ name }).lean();
    if (!monitor) throw new Error(`Monitor not found: ${name}`);

    const snapshots = await MetricSnapshot.find({ monitorId: monitor._id })
      .sort({ ts: -1 }).limit(20).lean();

    const payload = {
      id:            monitor._id,
      name:          monitor.name,
      type:          monitor.type,
      status:        monitor.enabled ? monitor.status : 'disabled',
      enabled:       monitor.enabled,
      category:      monitor.category || null,
      description:   monitor.description || null,
      checkInterval: monitor.checkInterval,
      lastChecked:   monitor.lastChecked,
      lastError:     monitor.lastError || null,
      metrics:       monitor.metrics || null,
      maintenance:   monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > new Date() ? monitor.maintenanceUntil : null,
      recentSnapshots: snapshots.map(s => ({ ts: s.ts, status: s.status, value: s.value })),
    };

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      }],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const Monitor        = require('../models/Monitor');
    const Incident       = require('../models/Incident');
    const MetricSnapshot = require('../models/MetricSnapshot');
    const { name, arguments: args = {} } = req.params;

    try {
      if (name === 'list_monitors') {
        const filter = {};
        if (args.status !== undefined)  filter.status  = args.status;
        if (args.category !== undefined) filter.category = args.category;
        if (args.enabled !== undefined)  filter.enabled  = args.enabled;
        const monitors = await Monitor.find(filter).sort({ position: 1, name: 1 }).lean();
        const result = monitors.map(m => ({
          id:          m._id,
          name:        m.name,
          type:        m.type,
          status:      m.enabled ? m.status : 'disabled',
          enabled:     m.enabled,
          category:    m.category || null,
          description: m.description || null,
          lastChecked: m.lastChecked,
          maintenance: m.maintenanceUntil && new Date(m.maintenanceUntil) > new Date() ? m.maintenanceUntil : null,
        }));
        return text(JSON.stringify(result, null, 2));
      }

      if (name === 'get_monitor') {
        const { id } = args;
        if (!id) return text('Error: id is required');
        const mongoose = require('mongoose');
        let monitor = null;
        if (mongoose.Types.ObjectId.isValid(id)) monitor = await Monitor.findById(id).lean();
        if (!monitor) monitor = await Monitor.findOne({ name: id }).lean();
        if (!monitor) return text(`Monitor not found: ${id}`);

        const snapshots = await MetricSnapshot.find({ monitorId: monitor._id })
          .sort({ ts: -1 }).limit(20).lean();

        return text(JSON.stringify({
          id:            monitor._id,
          name:          monitor.name,
          type:          monitor.type,
          status:        monitor.enabled ? monitor.status : 'disabled',
          enabled:       monitor.enabled,
          category:      monitor.category || null,
          description:   monitor.description || null,
          checkInterval: monitor.checkInterval,
          lastChecked:   monitor.lastChecked,
          lastError:     monitor.lastError || null,
          metrics:       monitor.metrics || null,
          maintenance:   monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > new Date() ? monitor.maintenanceUntil : null,
          recentSnapshots: snapshots.map(s => ({ ts: s.ts, status: s.status, value: s.value })),
        }, null, 2));
      }

      if (name === 'list_incidents') {
        const filter = {};
        if (args.open_only)  filter.resolvedAt = null;
        if (args.monitor_id) filter.monitorId  = args.monitor_id;
        const limit = Math.min(Number(args.limit) || 10, 100);
        const incidents = await Incident.find(filter)
          .sort({ startedAt: -1 }).limit(limit).lean();
        return text(JSON.stringify(incidents, null, 2));
      }

      if (name === 'get_stats') {
        const monitors = await Monitor.find().lean();
        return text(JSON.stringify({
          total:    monitors.length,
          online:   monitors.filter(m => m.enabled && m.status === 'online').length,
          offline:  monitors.filter(m => m.enabled && m.status === 'offline').length,
          warning:  monitors.filter(m => m.enabled && m.status === 'warning').length,
          error:    monitors.filter(m => m.enabled && m.status === 'error').length,
          unknown:  monitors.filter(m => m.enabled && m.status === 'unknown').length,
          disabled: monitors.filter(m => !m.enabled).length,
        }, null, 2));
      }

      if (name === 'trigger_check') {
        const { id } = args;
        if (!id) return text('Error: id is required');
        const monitor = await Monitor.findById(id).lean();
        if (!monitor) return text(`Monitor not found: ${id}`);
        const { triggerNow } = require('../monitors/runner');
        await triggerNow(id);
        return text(`Check triggered for "${monitor.name}"`);
      }

      return text(`Unknown tool: ${name}`);
    } catch (err) {
      return text(`Error: ${err.message}`);
    }
  });

  return server;
}

module.exports = { createServer };
