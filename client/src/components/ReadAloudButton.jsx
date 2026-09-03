import { useEffect, useRef, useState } from "react";
import { fetchFeedbackAudio } from "../api";
import { INITIAL_READ_ALOUD_STATE, nextReadAloudState, readAloudLabel, shouldOfferReadAloud } from "../readAloud";

// Play/Pause control that asks the server for spoken audio of a feedback
// record. Audio is fetched once per record and replayed from memory.
export function ReadAloudButton({ feedback }) {
  const [state, setState] = useState(INITIAL_READ_ALOUD_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const feedbackId = feedback?.id;

  function dispatch(event) {
    setState((current) => nextReadAloudState(current, event));
  }

  function release() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  // Start fresh for each feedback record and free the audio when the panel goes away.
  useEffect(() => {
    setState(INITIAL_READ_ALOUD_STATE);
    setErrorMessage("");
    return release;
  }, [feedbackId]);

  if (!shouldOfferReadAloud(feedback)) return null;

  function fail(error) {
    setErrorMessage(error?.message || "Read aloud is unavailable right now.");
    dispatch("fail");
  }

  async function play(audio) {
    try {
      await audio.play();
    } catch (error) {
      fail(new Error(error?.message ? `The audio could not be played: ${error.message}` : "The audio could not be played."));
      return false;
    }
    return true;
  }

  async function handleClick() {
    if (state === "loading") return;
    if (state === "playing") {
      audioRef.current?.pause();
      dispatch("pause");
      return;
    }
    if (state === "paused" && audioRef.current) {
      if (await play(audioRef.current)) dispatch("play");
      return;
    }
    if (state === "idle" && audioRef.current) {
      audioRef.current.currentTime = 0;
      if (await play(audioRef.current)) dispatch("play");
      return;
    }

    setErrorMessage("");
    dispatch("request");
    let blob;
    try {
      blob = await fetchFeedbackAudio(feedbackId);
    } catch (error) {
      fail(error);
      return;
    }
    release();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => dispatch("ended"));
    audio.addEventListener("error", () => fail(new Error("The audio could not be played.")));
    audioRef.current = audio;
    urlRef.current = url;
    if (await play(audio)) dispatch("ready");
  }

  const loading = state === "loading";
  return (
    <div className="read-aloud">
      <button
        type="button"
        className="secondary-button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading || undefined}
        aria-describedby={state === "error" ? "read-aloud-error" : undefined}
      >
        {readAloudLabel(state)}
      </button>
      {state === "error" && (
        <p id="read-aloud-error" className="error-message" role="alert">{errorMessage}</p>
      )}
    </div>
  );
}
