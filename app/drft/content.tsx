// drft's copy, moved verbatim off the old DrftLanding.tsx into the shared
// PluginContent shape. Only the launch-price sentences were touched — see the
// two PRICING interpolations below, and the dropped "limited" (there is no
// deadline) — and every discount-for-owning-the-other-plugin branch was
// deleted outright: drft has no such offer. Everything else is the original
// prose, unchanged.
//
// This is a .tsx, not a .ts: the six capability icons are JSX, copied
// verbatim (same viewBox/stroke/path data) from the pre-template
// DrftLanding.tsx.
import type { PluginContent } from "@/components/plugin-page/types"
import { PRICING } from "@/lib/products"

/* ---- capability icons (thin-line, matching the hardware look) ------------ */
function IconTape() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="8" cy="12" r="2.4" />
      <circle cx="16" cy="12" r="2.4" />
      <path d="M8 14.4h8" />
    </svg>
  )
}
function IconDice() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}
function IconPreset() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <circle cx="17" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}
function IconMono() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h4l2-6 3 12 3-9 2 3h4" />
    </svg>
  )
}
function IconSync() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7 9l3 2-3 2" />
    </svg>
  )
}
function IconAspect() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="10" rx="1.5" />
      <rect x="8.5" y="4" width="7" height="16" rx="1.5" />
    </svg>
  )
}

export const DRFT_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description: "VHS / CRT circuit-bend FX",
    caption: "One-time purchase • macOS & Windows • VST3 / AU / Standalone",
    media: {
      kind: "video",
      src: "/drft/hero.mp4",
      poster: "/drft/hero-poster.jpg",
      alt: "drft running on a video clip",
    },
  },

  intro: {
    eyebrow: "INSIDE DRFT",
    title: "A dying deck in your chain",
    body: "Tape wow, head burn, tracking wash, dropouts and snow - six knobs of damage on whatever you run through it, over a CRT that shows you every bit of what it does.",
  },

  blocks: [
    {
      osdTag: "TRK 01",
      title: "A picture behind the sound",
      body: "Drop a video, a GIF or a still onto the tube and it plays through the same circuit as your audio. Or go live: any camera your machine can see - a webcam, a capture card, or on a Mac your iPhone over Continuity Camera - point it at your hands, your desk, the room, and that becomes the picture.",
      media: {
        kind: "image",
        src: "/drft/live.jpg",
        alt: "drft's CRT tube showing a live camera feed run through the effect",
      },
    },
    {
      osdTag: "TRK 02",
      title: "Six knobs of character",
      body: "BURN scorches it hot, DRIFT lets the tape wander and leaves a blurred echo smearing behind the picture, BEND warps and skews, DROPOUT punches holes in the take, WASH softens everything to mush, NOISE buries it in snow. Sound and picture ride the same knobs - turn one and you hear it and see it move together.",
      media: {
        kind: "image",
        src: "/drft/knobs.png",
        alt: "drft character knobs - burn, drift, bend, dropout, wash, noise",
      },
    },
    {
      osdTag: "TRK 03",
      title: "When it drops, it drops everywhere",
      body: "Dropouts are wired straight across the machine: the instant one punches a hole in the audio, the picture tears with it. Not a visualizer guessing along - one event, heard and seen.",
      media: {
        kind: "image",
        src: "/drft/drop.png",
        alt: "drft dropout tearing the picture and the audio together",
      },
    },
    {
      osdTag: "TRK 04",
      title: "23 generators when you have no footage",
      body: "The FIELD page makes its own picture: 23 generators - flow, plasma, tunnel, kaleido, aurora, caustic, cells, mandala and more - shaped by hue, zoom, glow, tint and flow, with FOLLOW setting how hard they ride your audio. Then blend them: the BLEND fader luma-keys the generator against your video or your live camera, so your footage comes through the pattern instead of replacing it.",
      media: {
        kind: "image",
        src: "/drft/generators.jpg",
        alt: "drft's field generator filling the tube with a moving colour field",
      },
    },
    {
      osdTag: "TRK 05",
      title: "Break the television, not the tape",
      body: "The CIRCUIT page is six knobs that damage the set itself - and it runs on whatever is already on the tube, so it bends your footage and your camera the same way it bends the generators. The deflection coil pins and bows the raster. The colour reference dies, so the picture stops knowing what colour anything is and reads brightness as hue instead. INJECT puts your waveform into the video line, where bass draws slow curves down the screen and hats comb it into ripples. One DEPTH fader rides all of it at once.",
      media: {
        kind: "image",
        src: "/drft/circuit.jpg",
        alt: "drft's CIRCUIT page - the colour reference dying, brightness turned into hue",
      },
    },
    {
      osdTag: "TRK 06",
      title: "A canvas that remembers what you played",
      body: "PAINT is the FIELD page's other half, and a different instrument entirely. Nothing is generated fresh each frame - a buffer is redrawn into itself, turning and drifting and fading, while the transients in your track stamp new marks on top. What you played a few seconds ago is still up there, smeared and rotated away from what you are playing now. Six kinds of mark, including ink marbling that pushes the whole picture outward into nested contours.",
      media: {
        kind: "image",
        src: "/drft/paint.jpg",
        alt: "drft's PAINT page - ink marbling stamped onto a feedback canvas by the audio",
      },
    },
    {
      osdTag: "TRK 07",
      title: "The picture plays the sound",
      body: "feed reads the frame - how bright, how busy, how broken - and pushes it back into the audio. A hot white flash leans on the sound; a dead channel goes quiet. Run a music video through it and the mix starts breathing with the footage.",
      media: {
        kind: "image",
        src: "/drft/nosignal.png",
        alt: "drft on a dead channel - snow filling the tube",
      },
    },
    {
      osdTag: "TRK 08",
      title: "Press REC, keep the take",
      body: "The REC key captures the tube and the sound together and writes a real MP4 - the export re-renders every frame through the same pipeline, so the file matches what you watched. Frame it 16:9, vertical 9:16 for phones and reels, or ultrawide, and cut circuit-bent music videos straight out of the plugin.",
      media: {
        kind: "video",
        src: "/drft/rec.mp4",
        poster: "/drft/rec-poster.jpg",
        alt: "drft REC export - MP4 written from the plugin",
      },
    },
  ],

  caps: {
    title: "The rest of the chassis",
    items: [
      {
        icon: <IconTape />,
        title: "TAPE SPEED",
        body: "Slow the whole machine down. Pitch, picture and damage all follow, like a deck running on a dying motor.",
      },
      {
        icon: <IconDice />,
        title: "DICE",
        body: "One click re-rolls the character knobs into a new broken machine. Keep rolling until you find the one.",
      },
      {
        icon: <IconPreset />,
        title: "PRESETS",
        body: "A factory bank of broken machines, plus your own saves - user presets live in a plain folder on disk.",
      },
      {
        icon: <IconMono />,
        title: "BASS MONO",
        body: "All the wobble and smear stays up top - the low end folds to mono so the bottom never goes seasick.",
      },
      {
        icon: <IconSync />,
        title: "VIDEO SYNC",
        body: "The tube locks to your host transport, so the picture scrubs, loops and lands exactly with the session.",
      },
      {
        icon: <IconAspect />,
        title: "ASPECT",
        body: "16:9, vertical 9:16 for phones, or ultrawide - the tube reframes and the export follows it.",
      },
    ],
  },

  faq: [
    {
      q: "What is drft?",
      a: "drft is a VHS / CRT circuit-bend effect you put in your chain. Six character knobs - burn, drift, bend, dropout, wash, noise - run your audio through a dying tape machine, while a CRT on the panel shows the same damage on a picture: your video, a GIF, a live camera, or one of 23 built-in generators you can blend with your footage. Dropouts tear picture and sound together, feed lets the picture push back into the audio, and REC exports what you see and hear as a real MP4 in 16:9, 9:16 or ultrawide.",
    },
    {
      q: "Which formats does it come in, and will it work in my DAW?",
      a: "drft runs on macOS (Apple Silicon and Intel) as VST3, AU, and Standalone, and on Windows as VST3 and Standalone - so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
    },
    {
      q: "Do I need to use video?",
      a: "No. drft is a full audio effect on its own. If you never load a thing, the FIELD page still generates its own picture from your audio - the tube is never empty. Load footage or a camera when you want your own image, and press REC when you want to keep it.",
    },
    {
      q: "Is it a subscription?",
      a: `No. drft is a one-time purchase with free updates - buy it once, keep it forever. $${PRICING.drft.price}, off a $${PRICING.drft.msrp} list price.`,
    },
  ],

  buy: {
    title: "Get drft",
    body: `One-time purchase, free updates. $${PRICING.drft.price}, off a $${PRICING.drft.msrp} list price.`,
  },
}
