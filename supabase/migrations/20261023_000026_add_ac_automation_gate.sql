-- Connect room-level automation to the discovered device inventory. The public
-- client never receives webhook secrets; all automatic commands originate from
-- a server-side route authenticated with a Vercel environment variable.
alter table public.ac_room_controls
  add column if not exists controller_device_id uuid null references public.ac_devices(id) on delete set null,
  add column if not exists sensor_device_id uuid null references public.ac_devices(id) on delete set null;

create index if not exists ac_room_controls_controller_device_idx
  on public.ac_room_controls (controller_device_id);
create index if not exists ac_room_controls_sensor_device_idx
  on public.ac_room_controls (sensor_device_id);

alter table public.ac_command_audit
  drop constraint if exists ac_command_audit_command_type_check;
alter table public.ac_command_audit
  add constraint ac_command_audit_command_type_check
  check (command_type in ('pre_cool_start','pre_cool_extend','pre_cool_cancel','expiry_reconcile','no_motion_off'));

comment on column public.ac_room_controls.controller_device_id is 'Verified Cielo controller assigned to this room.';
comment on column public.ac_room_controls.sensor_device_id is 'Verified YoLink motion sensor assigned to this room.';
