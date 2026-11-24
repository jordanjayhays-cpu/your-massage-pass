import { AutoplayVideo } from "./AutoplayVideo";

interface Props {
  onClick?: () => void;
  className?: string;
}

const VIDEO_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/media/which-massage-quiz.mp4";
const POSTER_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/media/which-massage-quiz-poster.jpg";

/**
 * Vertical 9:16 quiz promo clip.
 * Autoplays only while at least 50% visible; pauses when out of view.
 * Respects prefers-reduced-motion by showing controls and never autoplaying.
 * Tapping the video fires the provided onClick handler.
 */
export function QuizPromoVideo({ onClick, className = "" }: Props) {
  return (
    <AutoplayVideo
      src={VIDEO_URL}
      poster={POSTER_URL}
      size="sm"
      className={`min-[900px]:max-w-[260px] ${className}`}
      label="Take the massage quiz"
      onClick={onClick}
    />
  );
}

export default QuizPromoVideo;
