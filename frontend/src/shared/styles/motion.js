// Shared animation CSS. Render once per page: <style>{MOTION_CSS}</style>
// Relies on the page's --accent CSS variable (rgb triplet).
export const MOTION_CSS = `
  @keyframes m-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
  @keyframes m-fade{from{opacity:0}to{opacity:1}}
  @keyframes m-line{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
  @keyframes m-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes m-drift-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(50px,35px,0) scale(1.15)}}
  @keyframes m-drift-b{0%,100%{transform:translate3d(0,0,0) scale(1.1)}50%{transform:translate3d(-45px,-30px,0) scale(.95)}}
  @keyframes m-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(-4deg)}}
  @keyframes m-ping{0%{box-shadow:0 0 0 0 currentColor}70%,100%{box-shadow:0 0 0 7px transparent}}
  @keyframes m-spin{from{transform:rotate(-90deg) scale(.6);opacity:0}to{transform:none;opacity:1}}

  /* Hero: one orchestrated load sequence */
  .m-hero{position:relative; isolation:isolate; overflow:hidden;}
  .m-blob{position:absolute; z-index:-1; border-radius:50%; filter:blur(80px); opacity:.28; pointer-events:none;}
  .m-blob.a{width:380px; height:380px; background:rgb(var(--accent)); top:-90px; left:6%; animation:m-drift-a 16s ease-in-out infinite;}
  .m-blob.b{width:320px; height:320px; background:#22d3ee; bottom:-100px; right:6%; animation:m-drift-b 19s ease-in-out infinite;}
  .dark .m-blob, [data-theme="dark"] .m-blob{opacity:.18;}
  .m-in{opacity:0; animation:m-rise .75s cubic-bezier(.2,.7,.2,1) forwards; animation-delay:calc(var(--d,0) * 1ms);}
  .m-hl{position:relative; display:inline-block;}
  .m-hl::after{content:""; position:absolute; left:0; right:0; bottom:.04em; height:.09em; border-radius:4px; background:currentColor; opacity:.35; transform-origin:left; transform:scaleX(0); animation:m-draw .8s .9s cubic-bezier(.2,.7,.2,1) forwards;}
  .m-bob{display:inline-block; animation:m-bob 3s ease-in-out infinite;}

  /* Scroll reveal */
  .m-reveal{opacity:0; transform:translateY(18px); transition:opacity .6s ease, transform .6s cubic-bezier(.2,.7,.2,1); transition-delay:calc(var(--d,0) * 1ms);}
  .m-reveal.in{opacity:1; transform:none;}
  .m-reveal > .pcard, .m-reveal > .fcard{display:block; height:100%;}

  /* Reacts to the user's action */
  .m-swap{animation:m-fade .35s ease;}
  .m-swap .mock .row{opacity:0; animation:m-line .4s ease forwards;}
  .m-swap .mock .row:nth-child(1){animation-delay:.05s}
  .m-swap .mock .row:nth-child(2){animation-delay:.12s}
  .m-swap .mock .row:nth-child(3){animation-delay:.19s}
  .m-swap .mock .row:nth-child(4){animation-delay:.26s}
  .m-swap .mock .row:nth-child(5){animation-delay:.33s}
  .m-spin{display:inline-flex; animation:m-spin .4s cubic-bezier(.2,.7,.2,1);}
  .pcard .icon, .fcard .icon{transition:transform .25s cubic-bezier(.2,.7,.2,1);}
  .pcard:hover .icon, .fcard:hover .icon{transform:scale(1.18) rotate(-8deg);}
  .btn{transition:transform .15s ease, background-color .15s ease, border-color .15s ease;}
  .btn:hover{transform:translateY(-1px);}
  .btn:active{transform:scale(.97);}

  /* "Live" badge pulse */
  .status.live.m-pulse::before{content:""; display:inline-block; width:6px; height:6px; margin-right:.4rem; border-radius:50%; background:currentColor; vertical-align:middle; animation:m-ping 1.8s ease-out infinite;}

  @media (prefers-reduced-motion:reduce){
    .m-in, .m-reveal, .m-swap, .m-swap .mock .row, .m-spin{animation:none!important; opacity:1!important; transform:none!important; transition:none!important;}
    .m-blob, .m-bob, .status.live.m-pulse::before{animation:none!important;}
    .m-hl::after{animation:none!important; transform:scaleX(1);}
  }
`;