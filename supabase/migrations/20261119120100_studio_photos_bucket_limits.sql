-- Optional hardening for studio-photos, which had no size or type limits.
-- Bucket limits apply to every caller, including the service-role media-upload function,
-- which has stored a video/mp4 here, so video/mp4 stays allowed.
-- Largest existing object is ~2.9 MB. PartnerPhotos.tsx uploads the original file without
-- resizing, so phone photos over 5 MB, or HEIC/GIF files, will be rejected with an error toast.

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
where id = 'studio-photos';
