/** The same waveform mark and wordmark used by ChatPPG's shared header. */
export default function ChatPpgBrand() {
  return (
    <a
      className="chatppg-tool-home"
      href="https://chatppg.com/"
      aria-label="Back to ChatPPG"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="38" height="38" rx="7" fill="#2855ff" />
        <path
          d="M7 25h4c2 0 2-14 6-14s3 11 6 11c2 0 2-4 4-4s2 7 6 7"
          stroke="#fdfdfe"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="30" cy="10" r="2" fill="#fdfdfe" opacity=".55" />
      </svg>
      <span>
        ChatPPG<span className="brand-period">.</span>
      </span>
    </a>
  );
}
