-- The people who edit a dance list can describe each dance in it, and link to
-- a description elsewhere. Both belong to the entry, not to the dance of the site.
ALTER TABLE dance_list_entries ADD COLUMN description TEXT;
ALTER TABLE dance_list_entries ADD COLUMN description_url VARCHAR(2000);
