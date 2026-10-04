"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type EditorRatio = "9:16" | "16:9" | "4:5" | "1:1";
interface EditorProps { entered:boolean; ratio:EditorRatio; importedFileName?:string; onClose:()=>void; }
type Tool="move"|"text"|"photo"|"sticker"|"eraser"|"stroke"|"layers";
type Align="left"|"center"|"right";
type StrokeStyle={enabled:boolean;width:number;color:string;opacity:number};
type TextLayer={id:string;text:string;x:number;y:number;fontFamily:string;fontSize:number;color:string;align:Align;rotation:number;opacity:number;stroke:StrokeStyle};
type EraserPoint={x:number;y:number};
type EraserStroke={id:string;points:EraserPoint[];size:number;hardness:number;opacity:number};
type PhotoLayer={id:string;src:string;name:string;x:number;y:number;width:number;height:number;rotation:number;opacity:number;eraserStrokes:EraserStroke[];stroke:StrokeStyle};
type AssetKind="sticker"|"gif"|"image";
type AssetLayer={id:string;kind:AssetKind;src:string;name:string;x:number;y:number;width:number;height:number;rotation:number;opacity:number;eraserStrokes:EraserStroke[];stroke:StrokeStyle};
type AssetGesture={type:"move"|"scale"|"rotate";id:string;startX:number;startY:number;startLayer:AssetLayer;startDistance:number;startAngle:number;anchorX:number;anchorY:number};
type Gesture={type:"move"|"scale"|"rotate";id:string;startX:number;startY:number;startLayer:TextLayer;startDistance:number;startAngle:number;anchorX:number;anchorY:number;startFrame?:{width:number;height:number}};
type PhotoGesture={type:"move"|"scale"|"rotate";id:string;startX:number;startY:number;startLayer:PhotoLayer;startDistance:number;startAngle:number;anchorX:number;anchorY:number};
type EraserUndo={kind:"photo"|"asset";id:string;strokeId:string};
type LiveEraser={kind:"photo"|"asset";id:string;pointerId:number;stroke:EraserStroke;pendingPoint:EraserPoint;lastRenderedPoint:EraserPoint;canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;width:number;height:number;frame:number|null};
type StrokeHistoryEntry={kind:"text"|"photo"|"asset";id:string;before:StrokeStyle;after:StrokeStyle};
const MASK_STYLE_CACHE=new Map<string,{signature:string;style:CSSProperties}>();
const DEFAULT_STROKE:StrokeStyle={enabled:false,width:6,color:"#ffffff",opacity:100};
const hexToRgba=(color:string,opacity:number)=>{const value=color.replace("#","");const full=value.length===3?value.split("").map(part=>part+part).join(""):value;const number=Number.parseInt(full,16);if(!Number.isFinite(number))return `rgba(255,255,255,${opacity/100})`;return `rgba(${number>>16},${number>>8&255},${number&255},${opacity/100})`;};
const TOOLS:Array<{id:Tool;label:string;icon:string}>=[{id:"move",label:"Move",icon:"✦"},{id:"text",label:"Text",icon:"T"},{id:"photo",label:"Photo",icon:"▧"},{id:"sticker",label:"Sticker",icon:"◇"},{id:"eraser",label:"Eraser",icon:"⌁"},{id:"stroke",label:"Stroke",icon:"◌"},{id:"layers",label:"Layers",icon:"≡"}];
const FONTS=["Inter","Arial","Georgia","Times New Roman","Courier New"];
const STICKERS=[
 {id:"spark",name:"Spark",tags:"spark star shine highlight",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><path fill='none' stroke='#111' stroke-width='12' stroke-linecap='round' d='M100 18v48M100 134v48M18 100h48M134 100h48M42 42l34 34M124 124l34 34M158 42l-34 34M76 124l-34 34'/><circle cx='100' cy='100' r='18' fill='#111'/></svg>")},
 {id:"heart",name:"Heart",tags:"heart love valentine romance",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><path fill='#e44' d='M100 168S28 126 28 75c0-25 17-43 40-43 16 0 26 9 32 20 6-11 16-20 32-20 23 0 40 18 40 43 0 51-72 93-72 93Z'/></svg>")},
 {id:"arrow",name:"Arrow",tags:"arrow direction pointer chevron",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 120'><path fill='none' stroke='#111' stroke-width='18' stroke-linecap='round' stroke-linejoin='round' d='M20 60h182m-56-38 56 38-56 38'/></svg>")},
 {id:"check",name:"Check",tags:"check tick done success",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 160'><path fill='none' stroke='#111' stroke-width='18' stroke-linecap='round' stroke-linejoin='round' d='M25 82 76 132 176 27'/></svg>")},
 {id:"circle",name:"Circle",tags:"circle shape round outline",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><circle cx='100' cy='100' r='68' fill='none' stroke='#111' stroke-width='16'/></svg>")},
 {id:"smile",name:"Smile",tags:"smile happy emoji face",src:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><circle cx='100' cy='100' r='72' fill='none' stroke='#111' stroke-width='14'/><circle cx='74' cy='82' r='8' fill='#111'/><circle cx='126' cy='82' r='8' fill='#111'/><path d='M62 112 Q100 150 138 112' fill='none' stroke='#111' stroke-width='10' stroke-linecap='round'/></svg>")}
];

export function Editor({entered,ratio,importedFileName,onClose}:EditorProps){
 const [activeTool,setActiveTool]=useState<Tool>("move");
 const [panelOpen,setPanelOpen]=useState(false);
 const [textLayers,setTextLayers]=useState<TextLayer[]>([]);
 const [photoLayers,setPhotoLayers]=useState<PhotoLayer[]>([]);
 const [assetLayers,setAssetLayers]=useState<AssetLayer[]>([]);
 const [assetTab,setAssetTab]=useState<AssetKind>("sticker");
 const [assetSearch,setAssetSearch]=useState("");
 const [selectedTextId,setSelectedTextId]=useState<string|null>(null);
 const [selectedPhotoId,setSelectedPhotoId]=useState<string|null>(null);
 const [selectedAssetId,setSelectedAssetId]=useState<string|null>(null);
	 const [fonts,setFonts]=useState(FONTS);
	 const [fontStatus,setFontStatus]=useState<string>("");
	 const [selectionFrame,setSelectionFrame]=useState<{width:number;height:number}|null>(null);
	 const [eraserSize,setEraserSize]=useState(48);
	 const [eraserHardness,setEraserHardness]=useState(75);
	 const [eraserOpacity,setEraserOpacity]=useState(100);
	 const [eraserUndo,setEraserUndo]=useState<EraserUndo[]>([]);
	 const [brushPreview,setBrushPreview]=useState<{kind:"photo"|"asset";id:string;x:number;y:number}|null>(null);
	 const [liveEraser,setLiveEraser]=useState<{kind:"photo"|"asset";id:string}|null>(null);
	 const [renderedEraserLayers,setRenderedEraserLayers]=useState<Record<string,boolean>>({});
	 const canvasRef=useRef<HTMLDivElement>(null);
 const gestureRef=useRef<Gesture|null>(null);
 const photoGestureRef=useRef<PhotoGesture|null>(null);
 const assetGestureRef=useRef<AssetGesture|null>(null);
 const photoInputRef=useRef<HTMLInputElement>(null);
	 const assetInputRef=useRef<HTMLInputElement>(null);
	 const textRefs=useRef<Record<string,HTMLDivElement|null>>({});
	 const eraserStrokeRef=useRef<LiveEraser|null>(null);
	 const strokeWorkCacheRef=useRef<Record<string,{work:HTMLCanvasElement;color:HTMLCanvasElement}>>({});
	 const strokeHistoryRef=useRef<{past:StrokeHistoryEntry[];future:StrokeHistoryEntry[]}>({past:[],future:[]});
	 const [strokeHistoryStatus,setStrokeHistoryStatus]=useState({canUndo:false,canRedo:false});
 const canvasStyle=useMemo(()=>({aspectRatio:({"9:16":"9 / 16","16:9":"16 / 9","4:5":"4 / 5","1:1":"1 / 1"} as Record<EditorRatio,string>)[ratio]}),[ratio]);
 const selectedText=textLayers.find(l=>l.id===selectedTextId)??null;
 const selectedPhoto=photoLayers.find(l=>l.id===selectedPhotoId)??null;
 const selectedAsset=assetLayers.find(l=>l.id===selectedAssetId)??null;
 const filteredStickers=STICKERS.filter(s=>{const q=assetSearch.trim().toLowerCase();return !q||`${s.name} ${s.tags}`.toLowerCase().includes(q);});
 const addText=()=>{const id=`text-${Date.now()}`;setTextLayers(c=>[...c,{id,text:"Double click to edit",x:50,y:50,fontFamily:fonts[0],fontSize:36,color:"#111",align:"center",rotation:0,opacity:1,stroke:{...DEFAULT_STROKE}}]);setSelectedTextId(id);setActiveTool("text");setPanelOpen(true);};
	 const chooseTool=(tool:Tool)=>{
	  setActiveTool(tool);
	  if(tool==="text"){
   setSelectedPhotoId(null);
   if(!selectedTextId)addText();else setPanelOpen(true);
  }else if(tool==="photo"){
   setSelectedTextId(null);
   setPanelOpen(true);
   setTimeout(()=>photoInputRef.current?.click(),0);
	  }else if(tool==="sticker"){
	   setSelectedTextId(null);setSelectedPhotoId(null);
	   setPanelOpen(true);
	  }else if(tool==="eraser"){
	   setPanelOpen(true);
	  }else setPanelOpen(tool!=="move");
	 };
 const updateSelectedText=(patch:Partial<TextLayer>)=>{if(!selectedTextId)return;setTextLayers(c=>c.map(l=>l.id===selectedTextId?{...l,...patch}:l));};
 const deleteSelectedText=()=>{if(!selectedTextId)return;setTextLayers(c=>c.filter(l=>l.id!==selectedTextId));setSelectedTextId(null);setPanelOpen(false);setSelectionFrame(null);};
 const updateSelectedPhoto=(patch:Partial<PhotoLayer>)=>{if(!selectedPhotoId)return;setPhotoLayers(c=>c.map(l=>l.id===selectedPhotoId?{...l,...patch}:l));};
 const deleteSelectedPhoto=()=>{if(!selectedPhotoId)return;setPhotoLayers(c=>c.filter(l=>l.id!==selectedPhotoId));setSelectedPhotoId(null);setPanelOpen(false);};
	 const maskStyle=(cacheKey:string,strokes:EraserStroke[]):CSSProperties=>{
	  if(!strokes.length)return {};
	  const signature=strokes.map(stroke=>`${stroke.id}:${stroke.points.length}:${stroke.size}:${stroke.hardness}:${stroke.opacity}`).join("|");
	  const cached=MASK_STYLE_CACHE.get(cacheKey);if(cached?.signature===signature)return cached.style;
	  const defs=strokes.map((stroke,index)=>`<filter id="b${index}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.max(0,(100-stroke.hardness)/100)*stroke.size*.35}"/></filter>`).join("");
	  const paths=strokes.map((stroke,index)=>{const d=stroke.points.map((p,i)=>`${i?"L":"M"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" ");return `<path d="${d}" fill="none" stroke="black" stroke-opacity="${(stroke.opacity/100).toFixed(3)}" stroke-width="${stroke.size.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#b${index})"/>`;}).join("");
	  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs><mask id="m"><rect width="100" height="100" fill="white"/>${paths}</mask><rect width="100" height="100" fill="white" mask="url(#m)"/></svg>`;
	  const url=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
	  const style={maskImage:url,WebkitMaskImage:url,maskMode:"luminance",maskSize:"100% 100%",WebkitMaskSize:"100% 100%"};MASK_STYLE_CACHE.set(cacheKey,{signature,style});return style;
	 };
	 const pointerToLayerPoint=(e:React.PointerEvent<HTMLElement>)=>{
	  const el=e.currentTarget;const rect=el.getBoundingClientRect();const width=Math.max(1,el.clientWidth);const height=Math.max(1,el.clientHeight);const rad=(Number(el.dataset.rotation)||0)*Math.PI/180;const dx=e.clientX-(rect.left+rect.width/2);const dy=e.clientY-(rect.top+rect.height/2);const x=dx*Math.cos(rad)+dy*Math.sin(rad)+width/2;const y=-dx*Math.sin(rad)+dy*Math.cos(rad)+height/2;return {x:Math.max(0,Math.min(100,x/width*100)),y:Math.max(0,Math.min(100,y/height*100))};
	 };
	 const addOrReplacePhoto=(file:File|undefined)=>{
  if(!file)return;
  const src=URL.createObjectURL(file);
  if(selectedPhotoId){
  setPhotoLayers(c=>c.map(l=>l.id===selectedPhotoId?{...l,src,name:file.name,eraserStrokes:[],stroke:{...DEFAULT_STROKE}}:l));
	  setRenderedEraserLayers(cur=>({...cur,[`photo:${selectedPhotoId}`]:false}));
   return;
  }
  const id=`photo-${Date.now()}`;
  setPhotoLayers(c=>[...c,{id,src,name:file.name,x:50,y:50,width:58,height:42,rotation:0,opacity:1,eraserStrokes:[],stroke:{...DEFAULT_STROKE}}]);
  setSelectedPhotoId(id);
  setSelectedTextId(null);
  setActiveTool("photo");
  setPanelOpen(false);
 };
 const addAsset=(kind:AssetKind,src:string,name:string)=>{
  const id=`asset-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  setAssetLayers(cur=>[...cur,{id,kind,src,name,x:50,y:50,width:42,height:30,rotation:0,opacity:1,eraserStrokes:[],stroke:{...DEFAULT_STROKE}}]);
  setSelectedAssetId(id);setSelectedTextId(null);setSelectedPhotoId(null);setPanelOpen(false);setActiveTool("move");
 };
 const addOrReplaceAsset=(file:File|undefined)=>{
  if(!file)return;
  const isGif=file.type==="image/gif"||file.name.toLowerCase().endsWith(".gif");
  const isImage=file.type.startsWith("image/")&&!isGif;
  if(!isGif&&!isImage)return;
  const src=URL.createObjectURL(file);
  const kind:AssetKind=isGif?"gif":"image";
  const id=`asset-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  setAssetLayers(cur=>[...cur,{id,kind,src,name:file.name,x:50,y:50,width:48,height:34,rotation:0,opacity:1,eraserStrokes:[],stroke:{...DEFAULT_STROKE}}]);
  setSelectedAssetId(id);setSelectedTextId(null);setSelectedPhotoId(null);setPanelOpen(false);setActiveTool("move");
 };
 const deleteSelectedAsset=(id:string)=>{setAssetLayers(cur=>cur.filter(l=>l.id!==id));setSelectedAssetId(null);};
 const updateSelectedAsset=(id:string,patch:Partial<AssetLayer>)=>setAssetLayers(cur=>cur.map(l=>l.id===id?{...l,...patch}:l));

 const duplicateSelectedPhoto=()=>{
  if(!selectedPhoto)return;
  const id=`photo-${Date.now()}`;
  const copy={...selectedPhoto,id,x:Math.min(92,selectedPhoto.x+5),y:Math.min(92,selectedPhoto.y+5),eraserStrokes:selectedPhoto.eraserStrokes.map(stroke=>({...stroke,points:stroke.points.map(point=>({...point}))})),stroke:{...selectedPhoto.stroke}};
  setPhotoLayers(c=>[...c,copy]);
  setSelectedPhotoId(id);
  setSelectedTextId(null);
 };
 const capture=(e:React.PointerEvent<HTMLElement>)=>{try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}};
 const measureSelectionFrame=(id:string)=>{const element=textRefs.current[id];if(!element)return selectionFrame;const rect=element.getBoundingClientRect();const frame={width:rect.width+12,height:rect.height+12};setSelectionFrame(frame);return frame;};
 const startMove=(e:React.PointerEvent<HTMLElement>,layer:TextLayer)=>{
  if(activeTool!=="move")return;
  e.preventDefault();e.stopPropagation();
  const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width*100;const py=(e.clientY-r.top)/r.height*100;const frame=measureSelectionFrame(layer.id);
  gestureRef.current={type:"move",id:layer.id,startX:px,startY:py,startLayer:layer,startDistance:0,startAngle:0,anchorX:0,anchorY:0,startFrame:frame||undefined};
  setSelectedTextId(layer.id);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const startScale=(e:React.PointerEvent<HTMLButtonElement>,layer:TextLayer)=>{
  e.preventDefault();e.stopPropagation();const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100;const cy=r.top+r.height*layer.y/100;const frame=measureSelectionFrame(layer.id)||selectionFrame||{width:0,height:0};
  gestureRef.current={type:"scale",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:Math.max(8,Math.hypot(e.clientX-cx,e.clientY-cy)),startAngle:0,anchorX:cx,anchorY:cy,startFrame:frame};
  setSelectedTextId(layer.id);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const startRotate=(e:React.PointerEvent<HTMLButtonElement>,layer:TextLayer)=>{
  e.preventDefault();e.stopPropagation();const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100;const cy=r.top+r.height*layer.y/100;const frame=measureSelectionFrame(layer.id)||selectionFrame||{width:0,height:0};
  gestureRef.current={type:"rotate",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:0,startAngle:Math.atan2(e.clientY-cy,e.clientX-cx),anchorX:cx,anchorY:cy,startFrame:frame};
  setSelectedTextId(layer.id);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const moveGesture=(e:React.PointerEvent)=>{
  const g=gestureRef.current,c=canvasRef.current;if(!g||!c)return;e.preventDefault();const r=c.getBoundingClientRect();
  if(g.type==="move"){
   const dx=((e.clientX-r.left)/r.width*100)-g.startX;const dy=((e.clientY-r.top)/r.height*100)-g.startY;
   const x=Math.max(2,Math.min(98,g.startLayer.x+dx));const y=Math.max(2,Math.min(98,g.startLayer.y+dy));
   setTextLayers(cur=>cur.map(l=>l.id===g.id?{...l,x,y,fontSize:g.startLayer.fontSize,rotation:g.startLayer.rotation,align:g.startLayer.align}:l));
   if(g.startFrame)setSelectionFrame(g.startFrame);
  }else if(g.type==="scale"){
   const distanceNow=Math.max(8,Math.hypot(e.clientX-g.anchorX,e.clientY-g.anchorY));const factor=Math.max(.25,Math.min(6,distanceNow/g.startDistance));
   setTextLayers(cur=>cur.map(l=>l.id===g.id?{...l,fontSize:Math.round(Math.max(10,Math.min(240,g.startLayer.fontSize*factor)))}:l));
   if(g.startFrame)setSelectionFrame({width:g.startFrame.width*factor,height:g.startFrame.height*factor});
  }else{
   const currentAngle=Math.atan2(e.clientY-g.anchorY,e.clientX-g.anchorX);let delta=(currentAngle-g.startAngle)*180/Math.PI;if(delta>180)delta-=360;if(delta<-180)delta+=360;
   setTextLayers(cur=>cur.map(l=>l.id===g.id?{...l,rotation:g.startLayer.rotation+delta}:l));if(g.startFrame)setSelectionFrame(g.startFrame);
  }
 };
 const endGesture=(e?:React.PointerEvent<HTMLElement>)=>{if(e&&e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);const g=gestureRef.current;gestureRef.current=null;if(g?.type==="scale")setTimeout(()=>measureSelectionFrame(g.id),0);};

 const startPhotoMove=(e:React.PointerEvent<HTMLElement>,layer:PhotoLayer)=>{
  if(activeTool!=="move"&&activeTool!=="photo")return;
  e.preventDefault();e.stopPropagation();
  const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width*100,py=(e.clientY-r.top)/r.height*100;
  photoGestureRef.current={type:"move",id:layer.id,startX:px,startY:py,startLayer:layer,startDistance:0,startAngle:0,anchorX:0,anchorY:0};
  setSelectedPhotoId(layer.id);setSelectedTextId(null);setActiveTool("photo");setPanelOpen(false);capture(e);
 };
 const startPhotoScale=(e:React.PointerEvent<HTMLButtonElement>,layer:PhotoLayer)=>{
  e.preventDefault();e.stopPropagation();
  const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100,cy=r.top+r.height*layer.y/100;
  photoGestureRef.current={type:"scale",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:Math.max(8,Math.hypot(e.clientX-cx,e.clientY-cy)),startAngle:0,anchorX:cx,anchorY:cy};
  setSelectedPhotoId(layer.id);setSelectedTextId(null);setActiveTool("photo");setPanelOpen(false);capture(e);
 };
 const startPhotoRotate=(e:React.PointerEvent<HTMLButtonElement>,layer:PhotoLayer)=>{
  e.preventDefault();e.stopPropagation();
  const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100,cy=r.top+r.height*layer.y/100;
  photoGestureRef.current={type:"rotate",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:0,startAngle:Math.atan2(e.clientY-cy,e.clientX-cx),anchorX:cx,anchorY:cy};
  setSelectedPhotoId(layer.id);setSelectedTextId(null);setActiveTool("photo");setPanelOpen(false);capture(e);
 };
 const movePhotoGesture=(e:React.PointerEvent)=>{
  const g=photoGestureRef.current,c=canvasRef.current;if(!g||!c)return;
  e.preventDefault();const r=c.getBoundingClientRect();
  if(g.type==="move"){
   const dx=((e.clientX-r.left)/r.width*100)-g.startX,dy=((e.clientY-r.top)/r.height*100)-g.startY;
   const x=Math.max(-20,Math.min(120,g.startLayer.x+dx)),y=Math.max(-20,Math.min(120,g.startLayer.y+dy));
   setPhotoLayers(cur=>cur.map(l=>l.id===g.id?{...l,x,y,width:g.startLayer.width,height:g.startLayer.height,rotation:g.startLayer.rotation}:l));
  }else if(g.type==="scale"){
   const distanceNow=Math.max(8,Math.hypot(e.clientX-g.anchorX,e.clientY-g.anchorY));
   const factor=Math.max(.15,Math.min(5,distanceNow/g.startDistance));
   setPhotoLayers(cur=>cur.map(l=>l.id===g.id?{...l,width:Math.max(8,Math.min(120,g.startLayer.width*factor)),height:Math.max(8,Math.min(120,g.startLayer.height*factor))}:l));
  }else{
   const currentAngle=Math.atan2(e.clientY-g.anchorY,e.clientX-g.anchorX);
   let delta=(currentAngle-g.startAngle)*180/Math.PI;if(delta>180)delta-=360;if(delta<-180)delta+=360;
   setPhotoLayers(cur=>cur.map(l=>l.id===g.id?{...l,rotation:g.startLayer.rotation+delta}:l));
  }
 };
 const endPhotoGesture=(e?:React.PointerEvent<HTMLElement>)=>{
  if(e&&e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  photoGestureRef.current=null;
 };
 const startAssetMove=(e:React.PointerEvent<HTMLElement>,layer:AssetLayer)=>{
  if(activeTool!=="move"&&activeTool!=="sticker")return;
  e.preventDefault();e.stopPropagation();const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width*100,py=(e.clientY-r.top)/r.height*100;
  assetGestureRef.current={type:"move",id:layer.id,startX:px,startY:py,startLayer:layer,startDistance:0,startAngle:0,anchorX:0,anchorY:0};
  setSelectedAssetId(layer.id);setSelectedTextId(null);setSelectedPhotoId(null);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const startAssetScale=(e:React.PointerEvent<HTMLButtonElement>,layer:AssetLayer)=>{
  e.preventDefault();e.stopPropagation();const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100,cy=r.top+r.height*layer.y/100;
  assetGestureRef.current={type:"scale",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:Math.max(8,Math.hypot(e.clientX-cx,e.clientY-cy)),startAngle:0,anchorX:cx,anchorY:cy};
  setSelectedAssetId(layer.id);setSelectedTextId(null);setSelectedPhotoId(null);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const startAssetRotate=(e:React.PointerEvent<HTMLButtonElement>,layer:AssetLayer)=>{
  e.preventDefault();e.stopPropagation();const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();
  const cx=r.left+r.width*layer.x/100,cy=r.top+r.height*layer.y/100;
  assetGestureRef.current={type:"rotate",id:layer.id,startX:e.clientX,startY:e.clientY,startLayer:layer,startDistance:0,startAngle:Math.atan2(e.clientY-cy,e.clientX-cx),anchorX:cx,anchorY:cy};
  setSelectedAssetId(layer.id);setSelectedTextId(null);setSelectedPhotoId(null);setActiveTool("move");setPanelOpen(false);capture(e);
 };
 const moveAssetGesture=(e:React.PointerEvent)=>{
  const g=assetGestureRef.current,c=canvasRef.current;if(!g||!c)return;e.preventDefault();const r=c.getBoundingClientRect();
  if(g.type==="move"){
   const dx=((e.clientX-r.left)/r.width*100)-g.startX,dy=((e.clientY-r.top)/r.height*100)-g.startY;
   setAssetLayers(cur=>cur.map(l=>l.id===g.id?{...l,x:Math.max(-20,Math.min(120,g.startLayer.x+dx)),y:Math.max(-20,Math.min(120,g.startLayer.y+dy)),width:g.startLayer.width,height:g.startLayer.height,rotation:g.startLayer.rotation}:l));
  }else if(g.type==="scale"){
   const factor=Math.max(.15,Math.min(5,Math.max(8,Math.hypot(e.clientX-g.anchorX,e.clientY-g.anchorY))/g.startDistance));
   setAssetLayers(cur=>cur.map(l=>l.id===g.id?{...l,width:Math.max(8,Math.min(120,g.startLayer.width*factor)),height:Math.max(8,Math.min(120,g.startLayer.height*factor))}:l));
  }else{
   const current=Math.atan2(e.clientY-g.anchorY,e.clientX-g.anchorX);let delta=(current-g.startAngle)*180/Math.PI;if(delta>180)delta-=360;if(delta<-180)delta+=360;
   setAssetLayers(cur=>cur.map(l=>l.id===g.id?{...l,rotation:g.startLayer.rotation+delta}:l));
  }
 };
	 const endAssetGesture=(e?:React.PointerEvent<HTMLElement>)=>{if(e&&e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);assetGestureRef.current=null;};
		 const drawCanvasStroke=(ctx:CanvasRenderingContext2D,stroke:EraserStroke,width:number,height:number)=>{
		  if(!stroke.points.length)return;ctx.save();ctx.globalCompositeOperation="destination-out";ctx.globalAlpha=stroke.opacity/100;ctx.lineWidth=Math.max(.5,stroke.size/100*width);ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor="rgba(0,0,0,1)";ctx.shadowBlur=Math.max(0,(100-stroke.hardness)/100*ctx.lineWidth*.35);ctx.beginPath();const first=stroke.points[0];if(stroke.points.length===1){ctx.arc(first.x/100*width,first.y/100*height,ctx.lineWidth/2,0,Math.PI*2);}else{ctx.moveTo(first.x/100*width,first.y/100*height);for(const point of stroke.points.slice(1))ctx.lineTo(point.x/100*width,point.y/100*height);}ctx.stroke();ctx.restore();
		 };
		 const drawImageToCanvas=(canvas:HTMLCanvasElement,img:HTMLImageElement,strokes:EraserStroke[])=>{
		  const width=Math.max(1,canvas.parentElement?.clientWidth||img.clientWidth);const height=Math.max(1,canvas.parentElement?.clientHeight||img.clientHeight);const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext("2d");if(!ctx)return null;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const naturalWidth=img.naturalWidth||width;const naturalHeight=img.naturalHeight||height;const scale=Math.min(width/naturalWidth,height/naturalHeight);const drawWidth=naturalWidth*scale;const drawHeight=naturalHeight*scale;ctx.drawImage(img,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);for(const stroke of strokes)drawCanvasStroke(ctx,stroke,width,height);return {ctx,width,height};
		 };
		 const renderLiveEraserFrame=(active:LiveEraser)=>{
		  const point=active.pendingPoint;if(point.x!==active.lastRenderedPoint.x||point.y!==active.lastRenderedPoint.y){drawCanvasStroke(active.ctx,{...active.stroke,points:[active.lastRenderedPoint,point]},active.width,active.height);active.lastRenderedPoint=point;}
		  const preview=document.querySelector(`[data-eraser-preview="${active.kind}:${active.id}"]`);if(preview instanceof HTMLElement){preview.style.left=`${point.x}%`;preview.style.top=`${point.y}%`;}
		 };
		 const scheduleLiveEraserFrame=()=>{const active=eraserStrokeRef.current;if(!active||active.frame!==null)return;active.frame=requestAnimationFrame(()=>{active.frame=null;renderLiveEraserFrame(active);});};
		 const startErase=(kind:"photo"|"asset",id:string,strokes:EraserStroke[],e:React.PointerEvent<HTMLElement>)=>{
		  if(activeTool!=="eraser")return;e.preventDefault();e.stopPropagation();const canvas=e.currentTarget.querySelector("canvas[data-eraser-canvas]");const img=e.currentTarget.querySelector("img");if(!(canvas instanceof HTMLCanvasElement)||!(img instanceof HTMLImageElement))return;const prepared=drawImageToCanvas(canvas,img,strokes);if(!prepared)return;
		  const point=pointerToLayerPoint(e);const width=Math.max(1,e.currentTarget.clientWidth);const stroke={id:`erase-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,points:[point],size:Math.max(.25,eraserSize/width*100),hardness:eraserHardness,opacity:eraserOpacity};const active:LiveEraser={kind,id,pointerId:e.pointerId,stroke,pendingPoint:point,lastRenderedPoint:point,canvas,ctx:prepared.ctx,width:prepared.width,height:prepared.height,frame:null};eraserStrokeRef.current=active;setLiveEraser({kind,id});setBrushPreview({kind,id,x:point.x,y:point.y});capture(e);drawCanvasStroke(active.ctx,stroke,active.width,active.height);
		 };
		 const moveErase=(e:React.PointerEvent<HTMLElement>)=>{
		  if(activeTool!=="eraser")return;const active=eraserStrokeRef.current;if(!active||active.pointerId!==e.pointerId)return;e.preventDefault();const point=pointerToLayerPoint(e);active.pendingPoint=point;active.stroke.points.push(point);scheduleLiveEraserFrame();
		 };
		 const endErase=(e?:React.PointerEvent<HTMLElement>)=>{
		  if(e&&e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);const active=eraserStrokeRef.current;if(!active)return;if(active.frame!==null){cancelAnimationFrame(active.frame);active.frame=null;}renderLiveEraserFrame(active);const finalStroke={...active.stroke,points:active.stroke.points.map(point=>({...point}))};const layerKey=`${active.kind}:${active.id}`;setEraserUndo(cur=>[...cur,{kind:active.kind,id:active.id,strokeId:finalStroke.id}]);if(active.kind==="photo")setPhotoLayers(cur=>cur.map(layer=>layer.id===active.id?{...layer,eraserStrokes:[...layer.eraserStrokes,finalStroke]}:layer));else setAssetLayers(cur=>cur.map(layer=>layer.id===active.id?{...layer,eraserStrokes:[...layer.eraserStrokes,finalStroke]}:layer));setRenderedEraserLayers(cur=>({...cur,[layerKey]:true}));eraserStrokeRef.current=null;setLiveEraser(null);setBrushPreview(null);
		 };
	 const undoErase=()=>{
	  const last=eraserUndo[eraserUndo.length-1];if(!last)return;
	  if(last.kind==="photo")setPhotoLayers(cur=>cur.map(layer=>layer.id===last.id?{...layer,eraserStrokes:layer.eraserStrokes.filter(stroke=>stroke.id!==last.strokeId)}:layer));
	  else setAssetLayers(cur=>cur.map(layer=>layer.id===last.id?{...layer,eraserStrokes:layer.eraserStrokes.filter(stroke=>stroke.id!==last.strokeId)}:layer));
	  setRenderedEraserLayers(cur=>({...cur,[`${last.kind}:${last.id}`]:false}));
	  setEraserUndo(cur=>cur.slice(0,-1));
	 };
	 const resetErase=()=>{
	  if(selectedPhoto)setPhotoLayers(cur=>cur.map(layer=>layer.id===selectedPhoto.id?{...layer,eraserStrokes:[]}:layer));
	  if(selectedAsset)setAssetLayers(cur=>cur.map(layer=>layer.id===selectedAsset.id?{...layer,eraserStrokes:[]}:layer));
	  if(selectedPhoto)setRenderedEraserLayers(cur=>({...cur,[`photo:${selectedPhoto.id}`]:false}));
	  if(selectedAsset)setRenderedEraserLayers(cur=>({...cur,[`asset:${selectedAsset.id}`]:false}));
	  setEraserUndo(cur=>cur.filter(item=>item.id!==(selectedPhoto?.id??selectedAsset?.id)));
	 };
	 const selectedStroke=selectedText?.stroke??selectedPhoto?.stroke??selectedAsset?.stroke??DEFAULT_STROKE;
	 const updateSelectedStroke=(patch:Partial<StrokeStyle>)=>{
	  const target=selectedText?{kind:"text" as const,id:selectedText.id,stroke:selectedText.stroke}:selectedPhoto?{kind:"photo" as const,id:selectedPhoto.id,stroke:selectedPhoto.stroke}:selectedAsset?{kind:"asset" as const,id:selectedAsset.id,stroke:selectedAsset.stroke}:null;if(!target)return;const after={...target.stroke,...patch};if(JSON.stringify(target.stroke)===JSON.stringify(after))return;strokeHistoryRef.current.past.push({kind:target.kind,id:target.id,before:{...target.stroke},after:{...after}});strokeHistoryRef.current.future=[];setStrokeHistoryStatus({canUndo:true,canRedo:false});if(target.kind==="text")setTextLayers(cur=>cur.map(layer=>layer.id===target.id?{...layer,stroke:after}:layer));else if(target.kind==="photo")setPhotoLayers(cur=>cur.map(layer=>layer.id===target.id?{...layer,stroke:after}:layer));else setAssetLayers(cur=>cur.map(layer=>layer.id===target.id?{...layer,stroke:after}:layer));
	 };
	 const applyStrokeHistory=(entry:StrokeHistoryEntry,stroke:StrokeStyle)=>{if(entry.kind==="text")setTextLayers(cur=>cur.map(layer=>layer.id===entry.id?{...layer,stroke:{...stroke}}:layer));else if(entry.kind==="photo")setPhotoLayers(cur=>cur.map(layer=>layer.id===entry.id?{...layer,stroke:{...stroke}}:layer));else setAssetLayers(cur=>cur.map(layer=>layer.id===entry.id?{...layer,stroke:{...stroke}}:layer));};
	 const undoStroke=()=>{const entry=strokeHistoryRef.current.past.pop();if(!entry)return;applyStrokeHistory(entry,entry.before);strokeHistoryRef.current.future.push(entry);setStrokeHistoryStatus({canUndo:strokeHistoryRef.current.past.length>0,canRedo:true});};
	 const redoStroke=()=>{const entry=strokeHistoryRef.current.future.pop();if(!entry)return;applyStrokeHistory(entry,entry.after);strokeHistoryRef.current.past.push(entry);setStrokeHistoryStatus({canUndo:true,canRedo:strokeHistoryRef.current.future.length>0});};
	 useEffect(()=>{
	  const layers=[...photoLayers.map(layer=>({key:`photo:${layer.id}`,src:layer.src,strokes:layer.eraserStrokes,stroke:layer.stroke})),...assetLayers.map(layer=>({key:`asset:${layer.id}`,src:layer.src,strokes:layer.eraserStrokes,stroke:layer.stroke}))];const cleanups:(()=>void)[]=[];
	  for(const layer of layers){const canvas=document.querySelector(`[data-stroke-canvas="${layer.key}"]`);const img=document.querySelector(`img[data-layer-image="${layer.key}"]`);if(!(canvas instanceof HTMLCanvasElement)||!(img instanceof HTMLImageElement))continue;const render=()=>{const width=Math.max(1,canvas.parentElement?.clientWidth||img.clientWidth),height=Math.max(1,canvas.parentElement?.clientHeight||img.clientHeight),dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const cached=strokeWorkCacheRef.current[layer.key]??{work:document.createElement("canvas"),color:document.createElement("canvas")};strokeWorkCacheRef.current[layer.key]=cached;cached.work.width=canvas.width;cached.work.height=canvas.height;cached.color.width=canvas.width;cached.color.height=canvas.height;const work=cached.work.getContext("2d"),color=cached.color.getContext("2d"),out=canvas.getContext("2d");if(!work||!color||!out)return;work.setTransform(dpr,0,0,dpr,0,0);work.clearRect(0,0,width,height);const naturalWidth=img.naturalWidth||width,naturalHeight=img.naturalHeight||height,scale=Math.min(width/naturalWidth,height/naturalHeight),drawWidth=naturalWidth*scale,drawHeight=naturalHeight*scale;work.drawImage(img,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);for(const erase of layer.strokes)drawCanvasStroke(work,erase,width,height);out.setTransform(dpr,0,0,dpr,0,0);out.clearRect(0,0,width,height);canvas.style.opacity="0";if(!layer.stroke.enabled||layer.stroke.width<=0)return;color.setTransform(dpr,0,0,dpr,0,0);color.clearRect(0,0,width,height);color.fillStyle=layer.stroke.color;color.fillRect(0,0,width,height);color.globalCompositeOperation="destination-in";color.drawImage(cached.work,0,0,width,height);color.globalCompositeOperation="source-over";const radius=layer.stroke.width,radialSteps=Math.max(1,Math.ceil(radius/4));for(let distance=1;distance<=radius;distance+=radialSteps){for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){out.drawImage(cached.color,Math.cos(angle)*distance,Math.sin(angle)*distance,width,height);}}out.globalCompositeOperation="destination-out";out.drawImage(cached.work,0,0,width,height);out.globalCompositeOperation="source-over";canvas.style.opacity=String(layer.stroke.opacity/100);};if(img.complete)render();else{img.addEventListener("load",render);cleanups.push(()=>img.removeEventListener("load",render));}}
	  return()=>{for(const cleanup of cleanups)cleanup();};
	 },[photoLayers,assetLayers]);
	 useEffect(()=>{
	  const exportDesign=()=>{const base=canvasRef.current;if(!base)return;const rect=base.getBoundingClientRect(),scale=2,out=document.createElement("canvas");out.width=Math.max(1,Math.round(rect.width*scale));out.height=Math.max(1,Math.round(rect.height*scale));const ctx=out.getContext("2d");if(!ctx)return;ctx.fillStyle="#f2f0ea";ctx.fillRect(0,0,out.width,out.height);const drawBitmap=(img:HTMLImageElement,strokes:EraserStroke[],stroke:StrokeStyle,w:number,h:number)=>{const image=document.createElement("canvas"),outline=document.createElement("canvas"),work=document.createElement("canvas"),color=document.createElement("canvas");for(const canvas of [image,outline,work,color]){canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));}const imageCtx=image.getContext("2d"),workCtx=work.getContext("2d"),outlineCtx=outline.getContext("2d"),colorCtx=color.getContext("2d");if(!imageCtx||!workCtx||!outlineCtx||!colorCtx)return null;const drawSource=(target:CanvasRenderingContext2D)=>{target.setTransform(scale,0,0,scale,0,0);const nw=img.naturalWidth||w,nh=img.naturalHeight||h,s=Math.min(w/nw,h/nh),dw=nw*s,dh=nh*s;target.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);};drawSource(imageCtx);drawSource(workCtx);for(const erase of strokes)drawCanvasStroke(imageCtx,erase,w,h);for(const erase of strokes)drawCanvasStroke(workCtx,erase,w,h);if(stroke.enabled&&stroke.width>0){outlineCtx.setTransform(scale,0,0,scale,0,0);colorCtx.setTransform(scale,0,0,scale,0,0);colorCtx.fillStyle=stroke.color;colorCtx.fillRect(0,0,w,h);colorCtx.globalCompositeOperation="destination-in";colorCtx.drawImage(work,0,0,w,h);colorCtx.globalCompositeOperation="source-over";const steps=Math.max(1,Math.ceil(stroke.width/4));for(let distance=1;distance<=stroke.width;distance+=steps)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12)outlineCtx.drawImage(color,Math.cos(angle)*distance,Math.sin(angle)*distance,w,h);outlineCtx.globalCompositeOperation="destination-out";outlineCtx.drawImage(work,0,0,w,h);outlineCtx.globalCompositeOperation="source-over";}return {image,outline};};const drawLayer=(img:HTMLImageElement,layer:PhotoLayer|AssetLayer)=>{const w=rect.width*layer.width/100,h=rect.height*layer.height/100,bitmap=drawBitmap(img,layer.eraserStrokes,layer.stroke,w,h);if(!bitmap)return;ctx.save();ctx.translate(rect.width*layer.x/100*scale,rect.height*layer.y/100*scale);ctx.rotate(layer.rotation*Math.PI/180);ctx.globalAlpha=layer.opacity*layer.stroke.opacity/100;if(layer.stroke.enabled)ctx.drawImage(bitmap.outline,-w/2*scale,-h/2*scale,w*scale,h*scale);ctx.globalAlpha=layer.opacity;ctx.drawImage(bitmap.image,-w/2*scale,-h/2*scale,w*scale,h*scale);ctx.restore();};for(const layer of photoLayers){const img=document.querySelector(`img[data-layer-image="photo:${layer.id}"]`);if(img instanceof HTMLImageElement)drawLayer(img,layer);}for(const layer of assetLayers){const img=document.querySelector(`img[data-layer-image="asset:${layer.id}"]`);if(img instanceof HTMLImageElement)drawLayer(img,layer);}for(const layer of textLayers){ctx.save();ctx.translate(rect.width*layer.x/100*scale,rect.height*layer.y/100*scale);ctx.rotate(layer.rotation*Math.PI/180);ctx.globalAlpha=layer.opacity;ctx.font=`${layer.fontSize*scale}px ${layer.fontFamily}`;ctx.textAlign=layer.align;ctx.textBaseline="middle";if(layer.stroke.enabled){ctx.lineWidth=layer.stroke.width*scale;ctx.strokeStyle=hexToRgba(layer.stroke.color,layer.stroke.opacity);ctx.strokeText(layer.text,0,0);}ctx.fillStyle=layer.color;ctx.fillText(layer.text,0,0);ctx.restore();}const link=document.createElement("a");link.download="paper-stish-design.png";link.href=out.toDataURL("image/png");link.click();};window.addEventListener("paper-stish-export",exportDesign);return()=>window.removeEventListener("paper-stish-export",exportDesign);
	 },[assetLayers,photoLayers,textLayers,ratio]);

 const importFont=async(file:File|undefined)=>{
  if(!file)return;
  setFontStatus("");
  const extension=file.name.split(".").pop()?.toLowerCase()||"";
  const supported=["ttf","otf","woff","woff2"];
  if(!supported.includes(extension)){setFontStatus("Use a .ttf, .otf, .woff, or .woff2 font.");return;}
  const cleanName=file.name.replace(/\.[^/.]+$/,"").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
  const family=(cleanName||`Imported Font ${fonts.length+1}`).slice(0,80);
  const fontUrl=URL.createObjectURL(file);
  try{
   const font=new FontFace(family,`url(${fontUrl})`);
   await font.load();
   document.fonts.add(font);
   setFonts(current=>current.includes(family)?current:[...current,family]);
   updateSelectedText({fontFamily:family});
   setFontStatus(`Installed “${family}” for this design.`);
  }catch{
   URL.revokeObjectURL(fontUrl);
   setFontStatus("That font could not be loaded in this browser.");
  }
 };
 return <main className={`fixed inset-0 z-50 overflow-hidden bg-[#050505] text-white transition-opacity duration-500 ${entered?"opacity-100":"opacity-0"}`} aria-label="Paper Stish editor">
  <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-20 py-20 s:px-30 s:py-25"><button type="button" onClick={onClose} className="group inline-flex items-center gap-10 text-14 text-white/75 hover:text-white"><span className="inline-flex size-32 items-center justify-center rounded-full bg-white/8">×</span><span className="hidden s:inline">MY</span></button><div className="absolute left-1/2 -translate-x-1/2 text-center"><p className="text-16">Paper Stish</p><p className="mt-2 text-11 text-white/40">{importedFileName||ratio}</p></div><button type="button" className="rounded-full bg-white px-18 py-9 text-13 text-black" onClick={()=>window.dispatchEvent(new CustomEvent("paper-stish-export"))}>Export</button></header>
  <div className="absolute inset-0 flex items-center justify-center px-18 pb-100 pt-85"><div className="relative flex h-full w-full items-center justify-center"><div ref={canvasRef} onPointerDown={()=>{if(activeTool==="move"){setSelectedTextId(null);setSelectedPhotoId(null);setSelectedAssetId(null)}}} className="relative max-h-full max-w-full overflow-hidden rounded-[18px] bg-[#f2f0ea] shadow-[0_30px_90px_rgba(0,0,0,.42)]" style={{...canvasStyle,width:"min(76vw, 62rem)"}}>
   {textLayers.length===0&&photoLayers.length===0&&assetLayers.length===0&&<div className="absolute inset-0 flex items-center justify-center text-center text-black/18 pointer-events-none"><p className="text-16">Your design</p></div>}
   <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e=>{addOrReplacePhoto(e.target.files?.[0]);e.currentTarget.value=""}}/>
   <input ref={assetInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" className="hidden" onChange={e=>{addOrReplaceAsset(e.target.files?.[0]);e.currentTarget.value=""}}/>

   {photoLayers.map(layer=>{
    const selected=layer.id===selectedPhotoId;
    const layerKey=`photo:${layer.id}`;const canvasVisible=Boolean(renderedEraserLayers[layerKey]||(liveEraser?.kind==="photo"&&liveEraser.id===layer.id));
    return <div key={layer.id} className="absolute inset-0 pointer-events-none">
     <div
      className="absolute select-none pointer-events-auto"
      onPointerDown={e=>activeTool==="eraser"?startErase("photo",layer.id,layer.eraserStrokes,e):startPhotoMove(e,layer)}
      onPointerMove={e=>activeTool==="eraser"?moveErase(e):movePhotoGesture(e)}
      onPointerUp={e=>activeTool==="eraser"?endErase(e):endPhotoGesture(e)}
      onPointerCancel={e=>activeTool==="eraser"?endErase(e):endPhotoGesture(e)}
      onPointerLeave={()=>activeTool==="eraser"&&setBrushPreview(null)}
      onClick={e=>{e.stopPropagation();setSelectedPhotoId(layer.id);setSelectedTextId(null);setSelectedAssetId(null);if(activeTool!=="eraser")setActiveTool("photo");if(activeTool!=="eraser")setPanelOpen(false);}}
      data-rotation={layer.rotation}
      style={{left:`${layer.x}%`,top:`${layer.y}%`,width:`${layer.width}%`,height:`${layer.height}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,opacity:layer.opacity,touchAction:"none",zIndex:selected?15:5}}
     >
      <canvas data-stroke-canvas={layerKey} aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 h-full w-full rounded-[10px]" style={{opacity:layer.stroke.enabled?layer.stroke.opacity/100:0}}/>
      <img data-layer-image={layerKey} src={layer.src} alt={layer.name} draggable={false} className="relative z-10 block h-full w-full rounded-[10px] object-contain select-none pointer-events-none" style={{...maskStyle(layerKey,layer.eraserStrokes),opacity:canvasVisible?0:1}}/>
      <canvas data-eraser-canvas={layerKey} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-[10px]" style={{opacity:canvasVisible?1:0}}/>
      {activeTool==="eraser"&&brushPreview?.kind==="photo"&&brushPreview.id===layer.id&&<span data-eraser-preview={`photo:${layer.id}`} className="pointer-events-none absolute z-40 rounded-full border-2 border-white bg-black/20" style={{left:`${brushPreview.x}%`,top:`${brushPreview.y}%`,width:eraserSize,height:eraserSize,transform:"translate(-50%,-50%)"}}/>}
     </div>
     {selected&&(activeTool==="photo"||activeTool==="move")&&<div
      className="absolute pointer-events-auto z-30 border-2 border-dashed border-red-500 rounded-[2px]"
      style={{left:`${layer.x}%`,top:`${layer.y}%`,width:`${layer.width}%`,height:`${layer.height}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,transformOrigin:"center center",touchAction:"none"}}
      onPointerDown={e=>startPhotoMove(e,layer)}
      onPointerMove={movePhotoGesture}
      onPointerUp={endPhotoGesture}
      onPointerCancel={endPhotoGesture}
     >
      <span className="pointer-events-none absolute left-1/2 top-[-37px] z-10 h-37 w-px bg-red-500 -translate-x-1/2"/>
      <button aria-label="Rotate photo" type="button" onPointerDown={e=>startPhotoRotate(e,layer)} onPointerMove={movePhotoGesture} onPointerUp={endPhotoGesture} onPointerCancel={endPhotoGesture} className="absolute left-1/2 top-[-54px] z-20 flex size-32 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↻</span></button>
      <button aria-label="Resize photo" type="button" onPointerDown={e=>startPhotoScale(e,layer)} onPointerMove={movePhotoGesture} onPointerUp={endPhotoGesture} onPointerCancel={endPhotoGesture} className="absolute right-[-16px] bottom-[-16px] z-20 flex size-32 translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↘</span></button>
     </div>}
   </div>})}

   {assetLayers.map(layer=>{
    const selected=layer.id===selectedAssetId;
    const layerKey=`asset:${layer.id}`;const canvasVisible=Boolean(renderedEraserLayers[layerKey]||(liveEraser?.kind==="asset"&&liveEraser.id===layer.id));
    return <div key={layer.id} className="absolute inset-0 pointer-events-none">
     <div className="absolute select-none pointer-events-auto" onPointerDown={e=>activeTool==="eraser"?startErase("asset",layer.id,layer.eraserStrokes,e):startAssetMove(e,layer)} onPointerMove={e=>activeTool==="eraser"?moveErase(e):moveAssetGesture(e)} onPointerUp={e=>activeTool==="eraser"?endErase(e):endAssetGesture(e)} onPointerCancel={e=>activeTool==="eraser"?endErase(e):endAssetGesture(e)} onPointerLeave={()=>activeTool==="eraser"&&setBrushPreview(null)}
      onClick={e=>{e.stopPropagation();setSelectedAssetId(layer.id);setSelectedTextId(null);setSelectedPhotoId(null);if(activeTool!=="eraser")setActiveTool("move");if(activeTool!=="eraser")setPanelOpen(false);}}
      data-rotation={layer.rotation}
      style={{left:`${layer.x}%`,top:`${layer.y}%`,width:`${layer.width}%`,height:`${layer.height}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,opacity:layer.opacity,touchAction:"none",zIndex:selected?18:7}}>
      <canvas data-stroke-canvas={layerKey} aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 h-full w-full rounded-[10px]" style={{opacity:layer.stroke.enabled?layer.stroke.opacity/100:0}}/>
      <img data-layer-image={layerKey} src={layer.src} alt={layer.name} draggable={false} className="relative z-10 block h-full w-full rounded-[10px] object-contain select-none pointer-events-none" style={{...maskStyle(layerKey,layer.eraserStrokes),opacity:canvasVisible?0:1}}/>
      <canvas data-eraser-canvas={layerKey} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-[10px]" style={{opacity:canvasVisible?1:0}}/>
      {activeTool==="eraser"&&brushPreview?.kind==="asset"&&brushPreview.id===layer.id&&<span data-eraser-preview={`asset:${layer.id}`} className="pointer-events-none absolute z-40 rounded-full border-2 border-white bg-black/20" style={{left:`${brushPreview.x}%`,top:`${brushPreview.y}%`,width:eraserSize,height:eraserSize,transform:"translate(-50%,-50%)"}}/>}
     </div>
     {selected&&activeTool!=="eraser"&&<div className="absolute pointer-events-auto z-30 border-2 border-dashed border-red-500 rounded-[2px]" style={{left:`${layer.x}%`,top:`${layer.y}%`,width:`${layer.width}%`,height:`${layer.height}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,transformOrigin:"center center",touchAction:"none"}} onPointerDown={e=>startAssetMove(e,layer)} onPointerMove={moveAssetGesture} onPointerUp={endAssetGesture} onPointerCancel={endAssetGesture}>
      <span className="pointer-events-none absolute left-1/2 top-[-37px] z-10 h-37 w-px bg-red-500 -translate-x-1/2"/>
      <button aria-label="Rotate asset" type="button" onPointerDown={e=>startAssetRotate(e,layer)} onPointerMove={moveAssetGesture} onPointerUp={endAssetGesture} onPointerCancel={endAssetGesture} className="absolute left-1/2 top-[-54px] z-20 flex size-32 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↻</span></button>
      <button aria-label="Resize asset" type="button" onPointerDown={e=>startAssetScale(e,layer)} onPointerMove={moveAssetGesture} onPointerUp={endAssetGesture} onPointerCancel={endAssetGesture} className="absolute right-[-16px] bottom-[-16px] z-20 flex size-32 translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↘</span></button>
     </div>}
    </div>
   })}

   {textLayers.map(layer=>{const selected=layer.id===selectedTextId;const frame=selectionFrame;return <div key={layer.id} className="absolute inset-0 pointer-events-none">
    <div ref={el=>{textRefs.current[layer.id]=el}} role="button" tabIndex={0} onPointerDown={e=>startMove(e,layer)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} onDoubleClick={e=>{e.stopPropagation();setSelectedTextId(layer.id);setActiveTool("text");setPanelOpen(true)}} onClick={e=>{e.stopPropagation();setSelectedTextId(layer.id);setActiveTool("move");setPanelOpen(false);measureSelectionFrame(layer.id)}} className={`absolute select-none pointer-events-auto px-4 py-2 outline-none ${activeTool==="move"?"cursor-move":"cursor-default"}`} style={{left:`${layer.x}%`,top:`${layer.y}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,fontFamily:layer.fontFamily,fontSize:`${layer.fontSize}px`,color:layer.color,opacity:layer.opacity,textAlign:layer.align,lineHeight:1.08,whiteSpace:"pre",width:"max-content",maxWidth:"none",touchAction:"none",zIndex:selected?20:10}}>
      <span className="relative z-20 block" style={{whiteSpace:"pre",width:"max-content",WebkitTextStroke:layer.stroke.enabled?`${layer.stroke.width}px ${hexToRgba(layer.stroke.color,layer.stroke.opacity)}`:"0 transparent",paintOrder:"stroke fill"}} onDoubleClick={e=>{e.stopPropagation();setSelectedTextId(layer.id);setActiveTool("text");setPanelOpen(true)}}>{layer.text}</span>
    </div>
    {selected&&activeTool==="move"&&frame&&<div className="absolute pointer-events-auto z-30" style={{left:`${layer.x}%`,top:`${layer.y}%`,width:`${frame.width}px`,height:`${frame.height}px`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`,transformOrigin:"center center"}}>
      <div className="absolute inset-0 rounded-[2px] border-2 border-dashed border-red-500 pointer-events-auto" onPointerDown={e=>startMove(e,layer)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} style={{touchAction:"none"}} aria-label="Move selected object"/>
      <span className="pointer-events-none absolute left-1/2 top-[-37px] z-10 h-37 w-px bg-red-500 -translate-x-1/2"/>
      <button aria-label="Rotate text" type="button" onPointerDown={e=>startRotate(e,layer)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute left-1/2 top-[-54px] z-20 flex size-32 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↻</span></button>
      <button aria-label="Resize text" type="button" onPointerDown={e=>startScale(e,layer)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute right-[-20px] top-1/2 z-20 flex size-32 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-md touch-none"><span>↔</span></button>
    </div>}
   </div>})}
   {importedFileName&&<div className="absolute left-12 top-12 rounded-full bg-black/75 px-10 py-6 text-10 text-white/85">{importedFileName}</div>}
  </div></div></div>
  <div className="absolute bottom-0 left-0 right-0 z-20 px-12 pb-18 s:px-30 s:pb-25"><div className="mx-auto flex max-w-[980px] items-end justify-center gap-6 rounded-[22px] border border-white/10 bg-black/55 p-7 backdrop-blur-xl"><div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto">{TOOLS.map(tool=>{const active=activeTool===tool.id;return <button key={tool.id} type="button" onClick={()=>chooseTool(tool.id)} className={`group flex min-w-[54px] shrink-0 flex-col items-center justify-center gap-4 rounded-[15px] px-8 py-8 transition-all ${active?"bg-white text-black":"text-white/65 hover:bg-white/8 hover:text-white"}`}><span className="flex size-21 items-center justify-center text-15">{tool.icon}</span><span className="text-10">{tool.label}</span></button>})}</div><div className="flex shrink-0 items-center gap-5 border-l border-white/10 pl-7"><button type="button" onClick={undoStroke} disabled={!strokeHistoryStatus.canUndo} className="inline-flex size-38 items-center justify-center text-18 text-white/70 disabled:opacity-30">↶</button><button type="button" onClick={redoStroke} disabled={!strokeHistoryStatus.canRedo} className="inline-flex size-38 items-center justify-center text-18 text-white/70 disabled:opacity-30">↷</button></div></div></div>

  {panelOpen&&activeTool==="sticker"&&<div className="absolute bottom-105 left-12 right-12 z-30 mx-auto max-w-[820px]"><div className="rounded-[20px] border border-white/10 bg-[#151515]/95 px-18 py-16 shadow-2xl backdrop-blur-xl">
   <div className="flex items-center justify-between"><div><p className="text-14">Library</p><p className="mt-2 text-11 text-white/40">Choose something to add to your design.</p></div><button type="button" onClick={()=>setPanelOpen(false)} className="size-32 rounded-full bg-white/7">×</button></div>
   <div className="mt-12 flex gap-6 rounded-full bg-white/5 p-1">
    <button type="button" onClick={()=>setAssetTab("sticker")} className={`flex-1 rounded-full px-12 py-8 text-11 ${assetTab==="sticker"?"bg-white text-black":"text-white/55"}`}>Stickers</button>
    <button type="button" onClick={()=>setAssetTab("gif")} className={`flex-1 rounded-full px-12 py-8 text-11 ${assetTab==="gif"?"bg-white text-black":"text-white/55"}`}>GIFs</button>
    <button type="button" onClick={()=>setAssetTab("image")} className={`flex-1 rounded-full px-12 py-8 text-11 ${assetTab==="image"?"bg-white text-black":"text-white/55"}`}>Images</button>
   </div>
   <div className="mt-12"><input value={assetSearch} onChange={e=>setAssetSearch(e.target.value)} placeholder={assetTab==="sticker"?"Search stickers...":assetTab==="gif"?"Search GIFs...":"Search images..."} className="w-full rounded-[12px] border border-white/10 bg-white/6 px-12 py-10 text-12 text-white outline-none"/></div>
   {assetTab==="sticker"&&<div className="mt-12 grid grid-cols-3 gap-8 s:grid-cols-6">{filteredStickers.map(sticker=><button key={sticker.id} type="button" onClick={()=>addAsset("sticker",sticker.src,sticker.name)} className="relative aspect-square overflow-hidden rounded-[14px] bg-[#f0eee8] p-10 text-black hover:scale-[1.02] transition-transform" aria-label={`Add ${sticker.name} sticker`}><img src={sticker.src} alt="" aria-hidden="true" className="h-full w-full object-contain"/></button>)}</div>}
   {assetTab!=="sticker"&&<div className="mt-12 rounded-[15px] border border-white/8 bg-white/4 px-14 py-16 text-center"><p className="text-12 text-white/70">Browse Paper Stish {assetTab==="gif"?"GIFs":"images"} and tap one to add it.</p><p className="mt-5 text-10 text-white/35">Select an item to place it on your canvas.</p></div>}
   {selectedAsset&&<div className="mt-12 flex items-center gap-8 border-t border-white/8 pt-12"><span className="min-w-0 flex-1 truncate text-10 text-white/40">Selected: {selectedAsset.name}</span><label className="text-10 text-white/40">Opacity <input type="range" min="0" max="100" value={Math.round(selectedAsset.opacity*100)} onChange={e=>updateSelectedAsset(selectedAsset.id,{opacity:Number(e.target.value)/100})}/></label><button type="button" onClick={()=>deleteSelectedAsset(selectedAsset.id)} className="rounded-full bg-white/7 px-10 py-7 text-10">Delete</button></div>}
  </div></div>}

  {panelOpen&&activeTool==="photo"&&<div className="absolute bottom-105 left-12 right-12 z-30 mx-auto max-w-[720px]"><div className="rounded-[20px] border border-white/10 bg-[#151515]/95 px-18 py-16 shadow-2xl backdrop-blur-xl">
   <div className="flex items-center justify-between"><div><p className="text-14">Photo</p><p className="mt-2 text-11 text-white/40">{selectedPhoto?"Adjust your selected photo.":"Add a photo to your design."}</p></div><button type="button" onClick={()=>setPanelOpen(false)} className="size-32 rounded-full bg-white/7">×</button></div>
   <div className="mt-14 grid gap-10">
    <button type="button" onClick={()=>photoInputRef.current?.click()} className="rounded-[13px] bg-white px-14 py-11 text-12 text-black">{selectedPhoto?"Replace photo":"Upload photo"}</button>
    {selectedPhoto&&<>
     <label className="grid gap-5 text-10 text-white/45">Opacity <span className="text-white/70">{Math.round(selectedPhoto.opacity*100)}%</span><input type="range" min="0" max="100" value={Math.round(selectedPhoto.opacity*100)} onChange={e=>updateSelectedPhoto({opacity:Number(e.target.value)/100})}/></label>
     <div className="flex flex-wrap gap-7"><button type="button" onClick={duplicateSelectedPhoto} className="rounded-full bg-white/8 px-13 py-8 text-11 text-white/75">Duplicate</button><button type="button" onClick={deleteSelectedPhoto} className="rounded-full bg-white/8 px-13 py-8 text-11 text-white/75">Delete</button></div>
    </>}
   </div>
  </div></div>}

  {panelOpen&&activeTool==="eraser"&&<div className="absolute bottom-105 left-12 right-12 z-30 mx-auto max-w-[720px]"><div className="rounded-[20px] border border-white/10 bg-[#151515]/95 px-18 py-16 shadow-2xl backdrop-blur-xl">
   <div className="flex items-center justify-between"><div><p className="text-14">Eraser</p><p className="mt-2 text-11 text-white/40">Erase parts of an image without changing the original.</p></div><button type="button" onClick={()=>setPanelOpen(false)} className="size-32 rounded-full bg-white/7">×</button></div>
   {!selectedPhoto&&!selectedAsset&&<p className="mt-14 rounded-[13px] border border-white/8 bg-white/4 px-12 py-11 text-12 text-white/65">{selectedTextId?"Eraser works on images.":"Select an image to start erasing."}</p>}
   {(selectedPhoto||selectedAsset)&&<div className="mt-14 grid gap-10">
    <label className="grid gap-5 text-10 text-white/45">Size <span className="text-white/70">{eraserSize}px</span><input type="range" min="8" max="240" value={eraserSize} onChange={e=>setEraserSize(Number(e.target.value))}/></label>
    <label className="grid gap-5 text-10 text-white/45">Hardness <span className="text-white/70">{eraserHardness}%</span><input type="range" min="0" max="100" value={eraserHardness} onChange={e=>setEraserHardness(Number(e.target.value))}/></label>
    <label className="grid gap-5 text-10 text-white/45">Opacity <span className="text-white/70">{eraserOpacity}%</span><input type="range" min="1" max="100" value={eraserOpacity} onChange={e=>setEraserOpacity(Number(e.target.value))}/></label>
    <div className="flex flex-wrap gap-7"><button type="button" onClick={undoErase} disabled={!eraserUndo.length} className="rounded-full bg-white/8 px-13 py-8 text-11 text-white/75 disabled:opacity-30">Undo Erase</button><button type="button" onClick={resetErase} className="rounded-full bg-white/8 px-13 py-8 text-11 text-white/75">Reset</button></div>
   </div>}
  </div></div>}

  {panelOpen&&activeTool==="stroke"&&<div className="absolute bottom-105 left-12 right-12 z-30 mx-auto max-w-[720px]"><div className="rounded-[20px] border border-white/10 bg-[#151515]/95 px-18 py-16 shadow-2xl backdrop-blur-xl">
   <div className="flex items-center justify-between"><div><p className="text-14">Stroke</p><p className="mt-2 text-11 text-white/40">Outline the visible shape without changing the original.</p></div><button type="button" onClick={()=>setPanelOpen(false)} className="size-32 rounded-full bg-white/7">×</button></div>
   {!selectedText&&!selectedPhoto&&!selectedAsset&&<p className="mt-14 rounded-[13px] border border-white/8 bg-white/4 px-12 py-11 text-12 text-white/65">Select text or an image to edit its outline.</p>}
   {(selectedText||selectedPhoto||selectedAsset)&&<div className="mt-14 grid gap-10">
    <button type="button" aria-pressed={selectedStroke.enabled} onClick={()=>updateSelectedStroke({enabled:!selectedStroke.enabled})} className={`flex items-center justify-between rounded-[13px] px-12 py-10 text-12 ${selectedStroke.enabled?"bg-white text-black":"bg-white/8 text-white/70"}`}><span>Stroke</span><span>{selectedStroke.enabled?"On":"Off"}</span></button>
    <label className="grid gap-5 text-10 text-white/45">Width <span className="text-white/70">{selectedStroke.width}px</span><input type="range" min="0" max="30" step="1" value={selectedStroke.width} onChange={e=>updateSelectedStroke({width:Number(e.target.value)})}/></label>
    <div className="flex flex-wrap items-center gap-10"><label className="flex items-center gap-7 text-10 text-white/45">Outline Color <input aria-label="Outline Color" type="color" value={selectedStroke.color} onChange={e=>updateSelectedStroke({color:e.target.value})} className="size-28"/></label><label className="flex items-center gap-7 text-10 text-white/45">HEX <input aria-label="Outline Color HEX" value={selectedStroke.color} onChange={e=>{const value=e.target.value;if(/^#[0-9a-fA-F]{6}$/.test(value))updateSelectedStroke({color:value})}} className="w-90 rounded-[10px] border border-white/10 bg-white/6 px-8 py-6 text-11 text-white outline-none"/></label></div>
    <label className="grid gap-5 text-10 text-white/45">Opacity <span className="text-white/70">{selectedStroke.opacity}%</span><input type="range" min="0" max="100" value={selectedStroke.opacity} onChange={e=>updateSelectedStroke({opacity:Number(e.target.value)})}/></label>
   </div>}
  </div></div>}

  {panelOpen&&activeTool==="text"&&<div className="absolute bottom-105 left-12 right-12 z-30 mx-auto max-w-[720px]"><div className="rounded-[20px] border border-white/10 bg-[#151515]/95 px-18 py-16 shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between"><div><p className="text-14">Text</p><p className="mt-2 text-11 text-white/40">Edit your selected text.</p></div><button type="button" onClick={()=>setPanelOpen(false)} className="size-32 rounded-full bg-white/7">×</button></div><div className="mt-14 grid gap-9"><textarea value={selectedText?.text??""} onChange={e=>updateSelectedText({text:e.target.value})} placeholder="Type something..." rows={2} className="w-full resize-none rounded-[13px] border border-white/10 bg-white/6 px-12 py-10 text-13 text-white outline-none"/><div className="flex flex-wrap gap-7"><button type="button" onClick={addText} className="rounded-full bg-white px-13 py-8 text-11 text-black">+ Add text</button>{selectedText&&<button type="button" onClick={deleteSelectedText} className="rounded-full bg-white/8 px-13 py-8 text-11 text-white/70">Delete</button>}</div><div className="grid gap-9 s:grid-cols-2"><label className="grid gap-5 text-10 text-white/45">Font<select value={selectedText?.fontFamily??fonts[0]} onChange={e=>updateSelectedText({fontFamily:e.target.value})} className="rounded-[11px] border border-white/10 bg-white/6 px-10 py-9 text-12 text-white"><option value="Inter">Inter</option>{fonts.filter(f=>f!=="Inter").map(font=><option key={font} value={font}>{font}</option>)}</select></label><label className="grid gap-5 text-10 text-white/45">Size <span className="text-white/70">{selectedText?.fontSize??36}px</span><input type="range" min="10" max="240" value={selectedText?.fontSize??36} onChange={e=>updateSelectedText({fontSize:Number(e.target.value)})}/></label><label className="grid gap-5 text-10 text-white/45">Opacity <span className="text-white/70">{Math.round((selectedText?.opacity??1)*100)}%</span><input type="range" min="0" max="100" value={Math.round((selectedText?.opacity??1)*100)} onChange={e=>updateSelectedText({opacity:Number(e.target.value)/100})}/></label></div><div className="flex flex-wrap items-center gap-10"><label className="flex items-center gap-7 text-10 text-white/45">Color <input type="color" value={selectedText?.color??"#111"} onChange={e=>updateSelectedText({color:e.target.value})} className="size-28"/></label>{(["left","center","right"] as Align[]).map(align=><button key={align} type="button" onClick={()=>updateSelectedText({align})} className={`rounded-full px-10 py-7 text-10 capitalize ${selectedText?.align===align?"bg-white text-black":"bg-white/7 text-white/60"}`}>{align}</button>)}<label className="cursor-pointer rounded-full bg-white/7 px-12 py-8 text-10 text-white/65">Install Font for This Design<input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={e=>{importFont(e.target.files?.[0]);e.currentTarget.value=""}}/></label></div>{fontStatus&&<p className="text-10 text-white/45">{fontStatus}</p>}</div></div></div>}
 </main>;
}
