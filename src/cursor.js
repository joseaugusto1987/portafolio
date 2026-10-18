/* HIPERNOVA — custom cursor (yellow dot that trails a small core; difference blend).
   Fine pointers only. Switches back to the native cursor inside the admin and in modals. */
(function(){
"use strict";
if (!matchMedia("(pointer:fine)").matches) return;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mk = (size, z) => {
  const d = document.createElement("div");
  Object.assign(d.style, {position: "fixed", left: 0, top: 0, width: size + "px", height: size + "px", marginLeft: -size / 2 + "px", marginTop: -size / 2 + "px", borderRadius: "50%", background: "#FDEE3D", pointerEvents: "none", zIndex: z, opacity: 0, transition: "opacity .3s", willChange: "transform"});
  d.setAttribute("aria-hidden", "true"); return d;
};
const dot = mk(14, 9999), core = mk(5, 10000);
dot.style.mixBlendMode = "difference";
document.body.append(dot, core); document.documentElement.classList.add("hn-cursor");
let mx = -200, my = -200, px = mx, py = my, shown = true;
const show = on => { dot.style.opacity = core.style.opacity = on ? 1 : 0; };
addEventListener("mousemove", e => {
  mx = e.clientX; my = e.clientY;
  shown = !e.target.closest("#adm,.mdl-bg");          // native cursor inside the admin
  show(shown);
}, {passive: true});
document.addEventListener("mouseleave", () => show(false));
const tick = () => {
  const k = reduced ? 1 : .25; px += (mx - px) * k; py += (my - py) * k;
  dot.style.transform = core.style.transform = `translate(${px}px,${py}px)`;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
})();
