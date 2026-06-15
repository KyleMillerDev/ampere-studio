"use strict";(()=>{var E="ampere-studio-editor",T="[data-ampere-block-id], [data-ampere-id], [data-ampere-json]",s="ampere-editable",m="ampere-editable-hover",u="ampere-editable-image",p="#2563eb",l="rgba(37, 99, 235, 0.12)",A="rgba(37, 99, 235, 0.35)";function g(e){let t={signature:E,...e};window.parent.postMessage(t,window.location.origin)}function M(){let e=document.createElement("style");e.setAttribute("data-ampere-editor-style","true"),e.textContent=`
    .${s} {
      outline: 1px dashed transparent;
      outline-offset: 2px;
      transition: outline-color 0.12s ease-in-out, background-color 0.12s ease-in-out;
      cursor: text !important;
      caret-color: ${p} !important;
    }
    .${s} *,
    .${s} *::before,
    .${s} *::after {
      cursor: text !important;
    }
    .${s}:hover,
    .${m} {
      outline-color: ${p} !important;
      background-color: ${l} !important;
    }
    .${s}[contenteditable="true"]:focus,
    .${s}[contenteditable="true"]:focus-visible {
      outline: 2px solid ${p} !important;
      outline-offset: 2px !important;
      background-color: ${l} !important;
    }
    .${s}::selection,
    .${s} ::selection {
      background-color: ${A} !important;
      color: inherit !important;
    }
    .${u} {
      outline: 2px dashed transparent;
      outline-offset: 2px;
      transition: outline-color 0.12s ease-in-out, background-color 0.12s ease-in-out, box-shadow 0.12s ease-in-out;
      cursor: pointer !important;
    }
    .${u}:hover,
    .${u}:focus,
    .${u}:focus-visible {
      outline-color: ${p} !important;
      background-color: ${l} !important;
      box-shadow: inset 0 0 0 9999px ${l} !important;
    }
  `,document.head.appendChild(e)}function L(e){if(["section","nav","header"].includes(e.tagName.toLowerCase()))return null;let t=e.getAttribute("data-ampere-block-type");if(t==="text")return"text";if(t==="image")return"image";if(t===null||t===""){if(e.tagName.toLowerCase()==="img")return"image";if(e.hasAttribute("data-ampere-id")||e.hasAttribute("data-ampere-json"))return"text"}return null}function k(e){return e.hasAttribute("data-ampere-json")?"json":"inline"}function b(e){var t,r;return(r=(t=e.getAttribute("data-ampere-json"))!=null?t:e.getAttribute("data-ampere-id"))!=null?r:""}function x(e,t){var d;e.classList.add(s),e.setAttribute("contenteditable","true"),e.setAttribute("spellcheck","true");let r=(d=e.textContent)!=null?d:"",o=()=>{var c;let n=(c=e.textContent)!=null?c:"";n!==r&&(r=n,g({kind:"change",blockId:t,targetId:b(e),sourceType:k(e),type:"text",newValue:n}))};e.addEventListener("input",o),e.addEventListener("focus",()=>e.classList.add(m)),e.addEventListener("blur",()=>{e.classList.remove(m),o()})}function $(e,t){e.classList.add(u),e.setAttribute("tabindex","0");let r=o=>{o.preventDefault(),o.stopPropagation(),g({kind:"open-media",blockId:t,targetId:b(e),sourceType:k(e)})};e.addEventListener("click",r),e.addEventListener("keydown",o=>{o instanceof KeyboardEvent&&(o.key==="Enter"||o.key===" ")&&r(o)})}function f(){var o,d;M();let e=S(),t=Array.from(document.querySelectorAll(T)),r=0;for(let n of t){let c=b(n),a=c?e.get(c):void 0,i=(d=(o=n.getAttribute("data-ampere-block-id"))!=null?o:a==null?void 0:a.blockId)!=null?d:c;if(!i)continue;n.setAttribute("data-ampere-block-id",i),!n.hasAttribute("data-ampere-block-type")&&(a!=null&&a.type)&&n.setAttribute("data-ampere-block-type",a.type);let y=L(n);y==="text"?(x(n,i),r+=1):y==="image"&&($(n,i),r+=1)}window.__ampereSetValue=(n,c,a)=>{let i=document.querySelector(`[data-ampere-block-id="${CSS.escape(n)}"]`);i&&(c==="image"?i.tagName.toLowerCase()==="img"?i.src=a:(i.setAttribute("data-ampere-src",a),i.style.backgroundImage=`url(${JSON.stringify(a)})`):c==="text"&&(i.textContent=a))},g({kind:"ready",count:r})}function S(){let e=window.__ampereBlockMap;return Array.isArray(e)?new Map(e.map(t=>[t.targetId,t])):new Map}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):f();})();
