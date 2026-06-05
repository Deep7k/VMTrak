'use strict';

const { z } = require('zod');

// ── Auth ──────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

const initialSetupSchema = z.object({
  email:    z.string().email().max(256),
  password: z.string().min(8).max(256),
});

// ── Users ─────────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  username:   z.string().min(2).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid username'),
  email:      z.string().email().max(256),
  password:   z.string().min(8).max(256),
  role:       z.enum(['admin', 'readwrite', 'read']).default('readwrite'),
  department: z.string().max(128).optional().nullable(),
});

const updateUserSchema = z.object({
  email:         z.string().email().max(256).optional(),
  role:          z.enum(['admin', 'readwrite', 'read']).optional(),
  is_active:     z.boolean().optional(),
  notify_expiry: z.boolean().optional(),
  department:    z.string().max(128).optional().nullable(),
});

const resetPasswordSchema = z.object({
  new_password: z.string().min(8).max(256),
});

// ── VMs ───────────────────────────────────────────────────────────────────────
const vmSchema = z.object({
  // Identity
  vm_name:     z.string().min(1).max(128),
  vm_tag:      z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),

  // Infrastructure
  hypervisor_id: z.coerce.number().int().positive().optional().nullable(),
  cluster:     z.string().max(128).optional().nullable(),
  datacenter:  z.string().max(128).optional().nullable(),

  // OS
  os_type:     z.enum(['Windows', 'Linux', 'Other']).optional().nullable(),
  os_version:  z.string().max(128).optional().nullable(),
  hostname:    z.string().max(253).optional().nullable(),

  // Network
  ip_address:  z.string().max(45).optional().nullable(),  // IPv4 or IPv6
  vlan:        z.string().max(64).optional().nullable(),
  mac_address: z.string().max(17).optional().nullable(),

  // Resources
  vcpu:        z.number().int().positive().optional().nullable(),
  ram_gb:      z.number().positive().optional().nullable(),
  disk_gb:     z.number().positive().optional().nullable(),

  // State
  power_state: z.enum(['on', 'off', 'suspended', 'unknown']).default('unknown'),
  environment: z.enum(['production', 'staging', 'development', 'test']).optional().nullable(),
  status:      z.enum(['active', 'decommissioned', 'maintenance']).default('active'),

  // Ownership
  owner:       z.string().max(256).optional().nullable(),
  department:  z.string().max(128).optional().nullable(),
  application: z.string().max(128).optional().nullable(),

  // Lifecycle
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional().nullable(),
  notes:       z.string().max(4096).optional().nullable(),
});

const updateVmSchema = vmSchema.partial().extend({
  vm_name: z.string().min(1).max(128).optional(),
});

// ── Credentials ───────────────────────────────────────────────────────────────
const createCredentialSchema = z.object({
  username:     z.string().min(1).max(128),
  password:     z.string().min(1).max(512),
  account_type: z.enum(['primary', 'others']).default('primary'),
  notes:        z.string().max(1024).optional().nullable(),
});

const updateCredentialSchema = z.object({
  username:     z.string().min(1).max(128).optional(),
  password:     z.string().min(1).max(512).optional(),
  account_type: z.enum(['primary', 'others']).optional(),
  notes:        z.string().max(1024).optional().nullable(),
});

// ── Audit query ───────────────────────────────────────────────────────────────
const auditQuerySchema = z.object({
  user_id:     z.coerce.number().int().optional(),
  action:      z.string().optional(),
  entity_type: z.enum(['vm', 'credential', 'user', 'auth']).optional(),
  from:        z.string().optional(),
  to:          z.string().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(200).default(50),
});

// ── VM list query ─────────────────────────────────────────────────────────────
const vmQuerySchema = z.object({
  search:      z.string().optional(),
  environment: z.enum(['production', 'staging', 'development', 'test']).optional(),
  status:      z.enum(['active', 'decommissioned', 'maintenance']).optional(),
  power_state: z.enum(['on', 'off', 'suspended', 'unknown']).optional(),
  department:   z.string().optional(),
  hypervisor_id: z.coerce.number().int().optional(),
  expiring_in:  z.coerce.number().int().min(0).optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(200).default(50),
  sort:        z.string().default('created_at'),
  order:       z.enum(['asc', 'desc']).default('desc'),
});

// ── Hypervisors ───────────────────────────────────────────────────────────────
const HYPERVISOR_TYPES = ['VMware vSphere', 'Proxmox', 'Hyper-V', 'KVM', 'Other'];

const createHypervisorSchema = z.object({
  name:        z.string().min(1).max(128),
  hostname:    z.string().max(253).optional().nullable(),
  type:        z.enum(HYPERVISOR_TYPES).optional().nullable(),
  version:     z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),
  status:      z.enum(['active', 'maintenance', 'decommissioned']).default('active'),
  environment: z.enum(['production', 'test']).optional().nullable(),
  vcpu:        z.number().int().positive().optional().nullable(),
  ram_gb:      z.number().positive().optional().nullable(),
  disk_gb:     z.number().positive().optional().nullable(),
});

const updateHypervisorSchema = createHypervisorSchema.partial();

// ── Validate helper ───────────────────────────────────────────────────────────
/**
 * Parse a Zod schema. Returns { data } on success, throws 400-friendly error on failure.
 */
function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.details = result.error.flatten().fieldErrors;
    throw err;
  }
  return result.data;
}

module.exports = {
  loginSchema,
  initialSetupSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  vmSchema,
  updateVmSchema,
  createCredentialSchema,
  updateCredentialSchema,
  auditQuerySchema,
  vmQuerySchema,
  createHypervisorSchema,
  updateHypervisorSchema,
  validate,
};
