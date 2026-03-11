// imports
import { useEffect, useState } from "react";
import "./App.css";
import PMPLogo from "./assets/PMPLogo.png";

// main App component
function App() {
  // states
  const [fadeOut, setFadeOut] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [activeDot, setActiveDot] = useState(0);

  // full text to type out
  const fullText = "Welcome to the one place for SFU schedules and professor insights.";

  useEffect(() => {
    // typing effect
    let index = 0;
    const startDelay = setTimeout(() => {
      const typingInterval = setInterval(() => {
        setTypedText(fullText.slice(0, index + 1));
        index++;
        if (index === fullText.length) clearInterval(typingInterval);
      }, 38);
      return () => clearInterval(typingInterval);
    }, 1100);

    // dots cycle
    const dotInterval = setInterval(() => {
      setActiveDot(d => (d + 1) % 3);
    }, 900);

    // fade out timer
    const fadeTimer = setTimeout(() => setFadeOut(true), 4400);

    return () => {
      clearTimeout(startDelay);
      clearInterval(dotInterval);
      clearTimeout(fadeTimer);
    };
  }, []);

  // render
  return (
    <div className={`splash-screen ${fadeOut ? "fade-out" : ""}`}>
      <div className="splash-content">
        <div className="splash-logo-wrapper">
          <img src={PMPLogo} alt="PickMyProf Logo" className="splash-logo" />
        </div>
        <p className="typing-text">
          {typedText}
          <span className="cursor">|</span>
        </p>
      </div>
      <div className="dot-indicators">
        {[0, 1, 2].map(i => (
          <span key={i} className={activeDot === i ? "active" : ""} />
        ))}
      </div>
    </div>
  );
}

export default App;