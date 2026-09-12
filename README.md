# ShowCue v5 — Universal Audio / Cut Track / Level Matching

Built from the locked ShowCue v4 baseline.

Changes in this version:
- Same responsive visual system across phone, iPad/tablet and PC, including landscape handling for older iPads.
- Songs accepts MP3, AIFF, FLAC, M4A, WAV and WMA by extension.
- Media accepts MP4, M4V, MOV and AVI by extension.
- Audio and video are stored locally in IndexedDB.
- Cue Pads preload assigned files to reduce iOS user-activation/autoplay problems.
- Pad launch cues and starts the assigned audio.
- Level Matching Sync raises softer analysed tracks toward the loudest analysed track at playback only; original files are never changed and louder tracks are not turned down.
- Cut Track detects leading silence/noise and starts up to four bars before the first detected audio. BPM is editable per song.
- Level matching and Cut Track analysis is performed only when enabled.
- The original v4 files remain the recovery baseline.

Browser codec limitation:
Importing a file and playing it are separate capabilities. Older iPad Air/Safari versions cannot natively decode every container/codec, especially WMA and AVI. ShowCue therefore imports and stores all requested extensions, while playback depends on the device/browser's native codec support. For the widest compatibility on iPad Air 1, use MP3/WAV/AIFF/common M4A audio and MP4/M4V/MOV video.


## v14 changes based on the supplied exact v6 baseline
- Home layout and navigation are preserved.
- Added Home EXIT button (subject to browser security restrictions).
- Added Media CLEAR ALL VIDEOS plus existing individual DELETE controls.
- Added complete Help / How-To Manual.
- Added selectable 2-Bar (8 beats) or 4-Bar (16 beats) lead-in for Cut Track.
- All original v6 files and assets are retained.


## v14 change
The approved v6-derived app layout is preserved. On small screens the Home page uses the reference two-column card geometry, 32px content margins, 18px gaps, ~255px card height, and the reference hero proportions. The Cue Pads playback bar is normal document flow on mobile so it scrolls up and down with the Cue Pads page rather than remaining sticky.

## v16 iPad Air compatibility
This build preserves the approved ShowCue layout and functionality while adding compatibility for older iPad Safari/WebKit. Interactive controls use the broadly supported click activation path rather than Pointer Events, the page uses legacy-safe scrolling, the mobile navigation is present in the HTML, and the service-worker cache was bumped so v16 is loaded instead of an older cached version.


## v20 iPad Air Cue Pad Edit
The Cue Pad pencil uses direct inline click/touchend calls to `openPadEdit(index)` with the existing delegated handler retained only as a propagation guard. Layout and editor behaviour are unchanged.
