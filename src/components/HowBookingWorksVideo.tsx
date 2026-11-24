import { AutoplayVideo } from "./AutoplayVideo";

interface Props {
  /** Max width of the phone frame in px (mobile). Desktop adds ~40px. */
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

const VIDEO_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/media/how-booking-works.mp4";
const POSTER_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/media/how-booking-works-poster.jpg";

/**
 * Vertical 9:16 explainer clip in a phone-sized frame.
 * Autoplays only while at least 50% visible; pauses when out of view.
 * Respects prefers-reduced-motion by showing controls and never autoplaying.
 */
export function HowBookingWorksVideo({ size = "md", className = "", label = "How booking works" }: Props) {
  return (
    <AutoplayVideo
      src={VIDEO_URL}
      poster={POSTER_URL}
      size={size}
      className={className}
      label={label}
    />
  );
}

export default HowBookingWorksVideo;
