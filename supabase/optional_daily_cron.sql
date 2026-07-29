-- =========================================================================
-- OPTIONAL / ADVANCED: fully automatic daily age check
-- =========================================================================
-- The app already checks ages automatically in the browser whenever the
-- admin opens the Admin Dashboard (see src/utils/promotionCheck.js), which
-- is enough for most clubs and needs zero setup.
--
-- If you'd rather have Supabase itself run the check every night even if
-- no admin logs in that day, run this file too. It uses the free pg_cron
-- extension that ships with every Supabase project — no extra hosting,
-- no cost.
-- =========================================================================

create extension if not exists pg_cron;

create or replace function check_and_flag_promotions()
returns void
language plpgsql
as $$
declare
  t text;
  group_code text;
  next_group text;
  r record;
begin
  foreach t, group_code in array array[
    array['shaheen_scouts','SS'],
    array['boy_scouts','BS'],
    array['rover_scouts','RS']
  ]
  loop
    for r in execute format(
      'select id, date_of_birth, promotion_due from %I where status = ''active''', t
    )
    loop
      -- work out live age in years
      declare
        live_age integer := date_part('year', age(current_date, r.date_of_birth));
        due_group text;
      begin
        if live_age < 12 then due_group := 'SS';
        elsif live_age < 18 then due_group := 'BS';
        else due_group := 'RS';
        end if;

        if due_group <> group_code and not r.promotion_due
           and (
             (group_code = 'SS' and due_group in ('BS','RS')) or
             (group_code = 'BS' and due_group = 'RS')
           )
        then
          execute format(
            'update %I set promotion_due = true, promotion_target = %L where id = %L',
            t, due_group, r.id
          );
        end if;
      end;
    end loop;
  end loop;
end;
$$;

-- Schedule it to run every day at 00:15 server time (cron syntax: min hour * * *)
select cron.schedule(
  'daily-scout-promotion-check',
  '15 0 * * *',
  $$ select check_and_flag_promotions(); $$
);

-- To remove the schedule later:
-- select cron.unschedule('daily-scout-promotion-check');
