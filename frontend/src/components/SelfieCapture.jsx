import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, RefreshCw, Loader2, Check, X } from "lucide-react";
import { matchFaces } from "@/lib/face";
import { cn } from "@/lib/utils";

/**
 * Live selfie capture + GPS + optional face match.
 * onCapture({ selfie, lat, lng, face_match })
 */
export default function SelfieCapture({ referenceFace, onCapture, onCancel, actionLabel = "Confirm Punch" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [shot, setShot] = useState(null);
  const [loc, setLoc] = useState(null);
  const [locErr, setLocErr] = useState("");
  const [matching, setMatching] = useState(false);
  const [faceMatch, setFaceMatch] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setReady(true);
    } catch (e) {
      setError("Camera access denied or unavailable. Please allow camera permission.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setLocErr("Location unavailable"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else setLocErr("Geolocation not supported");
    return stopCamera;
  }, [startCamera, stopCamera]);

  const capture = async () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    const w = 320, h = 240;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    setShot(data);
    stopCamera();
    if (referenceFace) {
      setMatching(true);
      const res = await matchFaces(referenceFace, data);
      setFaceMatch(res);
      setMatching(false);
    }
  };

  const retake = () => { setShot(null); setFaceMatch(null); startCamera(); };

  const confirm = () => {
    onCapture({ selfie: shot, lat: loc?.lat ?? null, lng: loc?.lng ?? null, face_match: faceMatch });
  };

  return (
    <div className="space-y-4" data-testid="selfie-capture">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900">
        {!shot && <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />}
        {shot && <img src={shot} alt="selfie" className="h-full w-full object-cover" />}
        {!shot && ready && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="oval-guide h-40 w-32 rounded-[50%]" />
          </div>
        )}
        {!ready && !shot && !error && (
          <div className="absolute inset-0 grid place-items-center text-white/80"><Loader2 className="animate-spin" /></div>
        )}
        {error && <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/90">{error}</div>}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <MapPin size={14} className={loc ? "text-emerald-600" : "text-amber-500"} />
        {loc ? (
          <span className="text-slate-600" data-testid="gps-status">GPS: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
        ) : (
          <span className="text-amber-600">{locErr || "Fetching location…"}</span>
        )}
      </div>

      {matching && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Matching face…</div>
      )}
      {faceMatch && (
        <div className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium",
          faceMatch.matched ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}
          data-testid="face-match-result">
          {faceMatch.matched ? <Check size={14} /> : <X size={14} />}
          {faceMatch.matched ? `Face matched (${faceMatch.confidence}%)` : `Face not matched (${faceMatch.confidence || 0}%)`}
        </div>
      )}
      {shot && referenceFace == null && (
        <p className="text-center text-xs text-slate-400">No reference face registered — selfie stored without match.</p>
      )}

      <div className="flex gap-2">
        {!shot ? (
          <>
            <Button variant="outline" onClick={onCancel} className="flex-1" data-testid="selfie-cancel-btn">Cancel</Button>
            <Button onClick={capture} disabled={!ready} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="selfie-capture-btn">
              <Camera size={16} className="mr-2" /> Capture
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={retake} className="flex-1" data-testid="selfie-retake-btn">
              <RefreshCw size={16} className="mr-2" /> Retake
            </Button>
            <Button onClick={confirm} disabled={matching} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="selfie-confirm-btn">
              {actionLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
