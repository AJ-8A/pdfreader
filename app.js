import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs";

const $=id=>document.getElementById(id);
const state={
  file:null,type:null,pdf:null,page:1,zoom:1,rotation:0,fitWidth:false,renderId:0,
  textCache:new Map(),searchResults:[],searchIndex:-1,workbook:null,currentSheet:0
};
const stage=$("readerStage"),canvas=$("pdfCanvas"),ctx=canvas.getContext("2d");
const thumbs=$("thumbs"),pageWrap=$("pageWrap"),officeView=$("officeView"),sheetTabs=$("sheetTabs"),welcome=$("welcome"),loading=$("loading");

function toast(message){const n=$("toast");n.textContent=message;n.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.remove("show"),2300)}
function setStatus(message){$("statusText").textContent=message}
function setLoading(on){loading.classList.toggle("hidden",!on)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function normalizeZoom(){state.zoom=clamp(state.zoom,.5,3)}
function fileType(file){
  const n=file.name.toLowerCase();
  if(n.endsWith(".pdf")||file.type==="application/pdf")return "pdf";
  if(n.endsWith(".docx")||file.type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document")return "docx";
  if(n.endsWith(".xlsx")||n.endsWith(".xls")||file.type.includes("spreadsheet")||file.type==="application/vnd.ms-excel")return "xlsx";
  if(n.endsWith(".csv")||file.type==="text/csv")return "csv";
  if(n.endsWith(".txt")||file.type==="text/plain")return "txt";
  return "";
}
function updateToolbar(){
  const pdf=state.type==="pdf"&&state.pdf;
  $("pageInput").value=state.page;
  $("pageCount").textContent=pdf?state.pdf.numPages:"—";
  $("zoomReadout").textContent=Math.round(state.zoom*100)+"%";
  $("prevButton").disabled=!pdf||state.page<=1;$("nextButton").disabled=!pdf||state.page>=state.pdf.numPages;
  $("pageInput").disabled=!pdf;
  $("zoomOut").disabled=!state.file;$("zoomIn").disabled=!state.file;$("fitButton").disabled=!state.file;$("rotateButton").disabled=!state.file;
  $("downloadButton").disabled=!state.file;$("printButton").disabled=!state.file;
}
function setViewer(type){
  pageWrap.classList.toggle("hidden",type!=="pdf");
  officeView.classList.toggle("hidden",!(type==="docx"||type==="txt"||type==="xlsx"||type==="csv"));
  sheetTabs.classList.toggle("hidden",type!=="xlsx"&&type!=="csv");
}
function clearViewer(){officeView.innerHTML="";sheetTabs.innerHTML="";thumbs.innerHTML="";canvas.width=0;canvas.height=0}
async function renderPage(number,{preserveScroll=false}={}){
  if(!state.pdf)return;
  const id=++state.renderId;state.page=clamp(Number(number)||1,1,state.pdf.numPages);updateToolbar();setLoading(true);
  try{
    const page=await state.pdf.getPage(state.page);if(id!==state.renderId)return;
    let viewport=page.getViewport({scale:1,rotation:state.rotation}),scale=state.zoom;
    if(state.fitWidth)scale=Math.max(280,stage.clientWidth-48)/viewport.width;
    viewport=page.getViewport({scale,rotation:state.rotation});
    const dpr=window.devicePixelRatio||1;
    canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);
    canvas.style.width=Math.floor(viewport.width)+"px";canvas.style.height=Math.floor(viewport.height)+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewport.width,viewport.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    pageWrap.classList.remove("hidden");welcome.classList.add("hidden");highlightThumb();
    setStatus("PDF • Page "+state.page+" of "+state.pdf.numPages);if(!preserveScroll)stage.scrollTop=0;
  }catch(error){console.error(error);toast("Unable to render this PDF page.");setStatus("Render error")}
  finally{if(id===state.renderId)setLoading(false)}
}
function highlightThumb(){
  thumbs.querySelectorAll(".thumb").forEach(node=>node.classList.toggle("active",Number(node.dataset.page)===state.page));
  thumbs.querySelector(".thumb.active")?.scrollIntoView({block:"nearest"});
}
async function buildThumbnails(){
  thumbs.innerHTML="";if(!state.pdf)return;
  for(let i=1;i<=state.pdf.numPages;i++){
    const item=document.createElement("button");item.type="button";item.className="thumb";item.dataset.page=i;
    const c=document.createElement("canvas");item.appendChild(c);
    const label=document.createElement("div");label.className="thumb-label";label.innerHTML="<span>Page "+i+"</span><span></span>";item.appendChild(label);
    item.onclick=()=>renderPage(i);thumbs.appendChild(item);renderThumbnail(i,c).catch(()=>{});
  }
}
async function renderThumbnail(pageNumber,target){
  const page=await state.pdf.getPage(pageNumber),base=page.getViewport({scale:1});
  const v=page.getViewport({scale:220/base.width}),dpr=window.devicePixelRatio||1;
  target.width=Math.floor(v.width*dpr);target.height=Math.floor(v.height*dpr);target.style.aspectRatio=v.width+"/"+v.height;
  const c=target.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);await page.render({canvasContext:c,viewport:v}).promise;
}
function escapeHTML(value){return String(value??"").replace(/[&<>\"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]))}
async function renderDocx(file){
  if(!window.mammoth)throw new Error("Word viewer library did not load.");
  const result=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
  officeView.innerHTML='<div class="docx-sheet">'+result.value+'</div>';
  officeView.classList.remove("hidden");welcome.classList.add("hidden");
  thumbs.innerHTML='<div class="sidebar-empty"><span>W</span><strong>Word document</strong><small>DOCX is rendered locally in the browser.</small></div>';
  setStatus("Word • ready");
}
function sheetButtons(){
  sheetTabs.innerHTML="";
  state.workbook.SheetNames.forEach((name,index)=>{
    const b=document.createElement("button");b.type="button";b.textContent=name;b.className=index===state.currentSheet?"active":"";
    b.onclick=()=>{state.currentSheet=index;renderWorkbookSheet()};sheetTabs.appendChild(b);
  });
}
function renderWorkbookSheet(){
  const name=state.workbook.SheetNames[state.currentSheet],ws=state.workbook.Sheets[name];
  officeView.innerHTML='<div class="sheet-shell"><div class="sheet-title"><span>Sheet</span><strong>'+escapeHTML(name)+'</strong></div><div class="sheet-table">'+window.XLSX.utils.sheet_to_html(ws,{header:"",footer:""})+'</div></div>';
  officeView.classList.remove("hidden");welcome.classList.add("hidden");setStatus("Excel • "+name+" • "+state.workbook.SheetNames.length+" sheet"+(state.workbook.SheetNames.length===1?"":"s"));renderOfficeScale();
}
async function renderExcel(file){
  if(!window.XLSX)throw new Error("Excel viewer library did not load.");
  state.workbook=window.XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});state.currentSheet=0;sheetButtons();renderWorkbookSheet();
}
async function renderCsv(file){
  if(!window.XLSX)throw new Error("Spreadsheet viewer library did not load.");
  state.workbook=window.XLSX.read(await file.text(),{type:"string"});state.currentSheet=0;sheetButtons();renderWorkbookSheet();setStatus("CSV • ready");renderOfficeScale();
}
async function renderTxt(file){
  officeView.innerHTML='<div class="text-sheet"><pre>'+escapeHTML(await file.text())+'</pre></div>';
  officeView.classList.remove("hidden");welcome.classList.add("hidden");
  thumbs.innerHTML='<div class="sidebar-empty"><span>TXT</span><strong>Text document</strong><small>Plain text stays local in your browser.</small></div>';setStatus("Text • ready");renderOfficeScale();
}
async function searchDocument(query){
  query=query.trim().toLowerCase();if(!query){toast("Type something to search.");return}
  if(!state.file){toast("Open a document first.");return}
  if(state.type==="pdf"){
    state.searchResults=[];
    for(let i=1;i<=state.pdf.numPages;i++){
      const text=state.textCache.get(i)??(await state.pdf.getPage(i).then(p=>p.getTextContent()).then(c=>c.items.map(x=>x.str||"").join(" ")));
      state.textCache.set(i,text.toLowerCase());
      if(text.toLowerCase().includes(query))state.searchResults.push({page:i});
      if(state.searchResults.length>=200)break;
    }
    if(!state.searchResults.length){toast("No matches found.");return}
    state.searchIndex=0;await renderPage(state.searchResults[0].page);toast(state.searchResults.length+" page"+(state.searchResults.length===1?"":"s")+" matched");return;
  }
  const text=(officeView.innerText||"").toLowerCase();const matches=text.split("\n").filter(line=>line.includes(query)).length;
  toast(matches?matches+" matching line"+(matches===1?"":"s")+" found":"No matches found");
}
async function loadFile(file){
  const type=file&&fileType(file);if(!file||!type){toast("Supported: PDF, Word DOCX, Excel XLS/XLSX, CSV and text.");return}
  state.file=file;state.type=type;state.pdf=null;state.workbook=null;state.page=1;state.zoom=1;state.rotation=0;state.fitWidth=false;state.textCache.clear();clearViewer();setViewer(type);setLoading(true);
  $("fileName").textContent=file.name;$("docMeta").textContent="Opening locally • no upload";
  try{
    if(type==="pdf"){state.pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;await buildThumbnails();await renderPage(1)}
    else if(type==="docx")await renderDocx(file);else if(type==="xlsx")await renderExcel(file);else if(type==="csv")await renderCsv(file);else await renderTxt(file);
    $("docMeta").textContent=(type==="pdf"?state.pdf.numPages+" page"+(state.pdf.numPages===1?"":"s"):type.toUpperCase())+" • ready";toast("Document ready");
  }catch(error){console.error(error);clearViewer();state.file=null;state.type=null;setViewer("");toast("This document could not be opened.");setStatus(error.message||"Could not open document")}
  finally{setLoading(false);updateToolbar()}
}
function renderOfficeScale(){
  if(!officeView||officeView.classList.contains("hidden"))return;
  const scale=state.zoom;officeView.style.transformOrigin="top center";officeView.style.transform="scale("+scale+")";officeView.style.width=(100/scale)+"%";officeView.style.marginBottom=Math.max(0,(scale-1)*60)+"px";
}
function downloadFile(){if(!state.file)return;const url=URL.createObjectURL(state.file),a=document.createElement("a");a.href=url;a.download=state.file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function printFile(){if(!state.file)return;const url=URL.createObjectURL(state.file),frame=document.createElement("iframe");frame.style.cssText="position:fixed;width:1px;height:1px;opacity:0";frame.src=url;document.body.appendChild(frame);frame.onload=()=>setTimeout(()=>{try{frame.contentWindow.print()}catch{}},300);setTimeout(()=>{URL.revokeObjectURL(url);frame.remove()},60000)}
function toggleFullscreen(){if(!document.fullscreenElement)$("app").requestFullscreen?.();else document.exitFullscreen?.()}
function openSidebar(){$("sidebar").classList.toggle("open")}
function wire(){
  $("openButton").onclick=()=>$("fileInput").click();$("welcomeOpen").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>loadFile(e.target.files?.[0]);
  $("sidebarButton").onclick=openSidebar;$("closeSidebar").onclick=openSidebar;
  $("prevButton").onclick=()=>state.pdf&&state.page>1&&renderPage(state.page-1);$("nextButton").onclick=()=>state.pdf&&state.page<state.pdf.numPages&&renderPage(state.page+1);
  $("pageInput").onchange=e=>state.pdf&&renderPage(e.target.value);
  $("zoomOut").onclick=()=>{state.zoom=clamp(state.zoom-.1,.5,3);state.pdf?renderPage(state.page,true):renderOfficeScale()};$("zoomIn").onclick=()=>{state.zoom=clamp(state.zoom+.1,.5,3);state.pdf?renderPage(state.page,true):renderOfficeScale()};
  $("zoomReadout").onclick=()=>{state.zoom=1;state.pdf?renderPage(state.page,true):renderOfficeScale()};
  $("fitButton").onclick=()=>{state.fitWidth=true;if(state.pdf)renderPage(state.page,true);else{state.zoom=1;renderOfficeScale()}};
  $("rotateButton").onclick=()=>{state.rotation=(state.rotation+90)%360;if(state.pdf)renderPage(state.page,true);else officeView.classList.toggle("rotated")};
  $("fullscreenButton").onclick=toggleFullscreen;$("printButton").onclick=printFile;$("downloadButton").onclick=downloadFile;
  $("themeButton").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("docuv_light",document.body.classList.contains("light")?"1":"0")};
  $("searchButton").onclick=()=>searchDocument($("searchInput").value);$("searchInput").onkeydown=e=>{if(e.key==="Enter")searchDocument(e.target.value)};
  stage.addEventListener("wheel",e=>{if(e.ctrlKey){e.preventDefault();state.zoom=clamp(state.zoom+(e.deltaY<0?.1:-.1),.5,3);state.pdf?renderPage(state.page,true):renderOfficeScale()}},{passive:false});
  ["dragenter","dragover"].forEach(t=>stage.addEventListener(t,e=>{e.preventDefault();stage.classList.add("dragging")}));
  ["dragleave","drop"].forEach(t=>stage.addEventListener(t,e=>{e.preventDefault();stage.classList.remove("dragging")}));
  stage.addEventListener("drop",e=>loadFile(e.dataTransfer?.files?.[0]));
  window.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;
    if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();if(state.pdf&&state.page<state.pdf.numPages)renderPage(state.page+1)}
    if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();if(state.pdf&&state.page>1)renderPage(state.page-1)}
    if(e.key==="+")$("zoomIn").click();if(e.key==="-")$("zoomOut").click();if(e.key==="f")toggleFullscreen();
  });
  if(localStorage.getItem("docuv_light")==="1")document.body.classList.add("light");
}
if("launchQueue" in window)window.launchQueue.setConsumer(async p=>{const f=p.files?.[0];if(f)loadFile(await f.getFile())});
wire();updateToolbar();setStatus("Ready");
