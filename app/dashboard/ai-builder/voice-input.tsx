"use client";

import { useRef, useState } from "react";

export default function VoiceInput({onTranscript}:{onTranscript:(text:string)=>void}){
  const [active,setActive]=useState(false);
  const recognition=useRef<any>(null);
  function start(){
    const Speech=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(Speech){
      const r=new Speech();
      r.lang="en-NG"; r.interimResults=true; r.continuous=false;
      r.onresult=(e:any)=>{let text="";for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript;onTranscript(text);};
      r.onend=()=>{setActive(false);recognition.current=null;};
      r.onerror=()=>{setActive(false);recognition.current=null;};
      recognition.current=r; setActive(true); r.start(); return;
    }
    setActive(false);
  }
  function stop(){recognition.current?.stop();recognition.current=null;setActive(false);}
  return <button type="button" onClick={()=>active?stop():start()} className={active?"w-11 h-11 rounded-full bg-alert text-white shrink-0":"w-11 h-11 rounded-full bg-ink text-white shrink-0"} title={active?"Stop voice input":"Speak to BizStack"}>{active?"■":"●"}</button>;
}
