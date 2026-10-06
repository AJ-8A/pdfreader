import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs";

const $=id=>document.getElementById(id);
const state={
  pdf:null,file:null,page:1,zoom:1,rotation:0,fitWidth:false,renderId:0,
  textCache:new Map(),searchResults:[],searchIndex:-1
};

const stage=$("readerStage"), canvas=$("pdfCanvas"), ctx=canvas.getContext("2d");
const thumbs=$("thumbs"), pageWrap=$("pageWrap"), welcome=$("welcome"), loading=$("loading");

function toast(message){
  const node=$("toast");node.textContent=message;node.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove("show"),2300);
}
function setStatus(message){$("statusText").textContent=message}
function setLoading(on){loading.classList.toggle("hidden",!on)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function normalizeZoom(){state.zoom=clamp(state.zoom,.5,3)}
function updateToolbar(){
  const total=state.pdf?.numPages||0;
  $("pageInput").value=state.page;$("pageCount").textContent=total;$("zoomReadout").textContent=Math.round(state.zoom*100)+"%";
  $("prevButton").disabled=!state.pdf||state.page<=1;$("nextButton").disabled=!state.pdf||state.page>=total;
  $("downloadButton").disabled=!state.file;$("printButton").disabled=!state.file;
}
async function renderPage(number,{preserveScroll=false}={}){
  if(!state.pdf)return;
  const id=++state.renderId;
  state.page=clamp(Number(number)||1,1,state.pdf.numPages);updateToolbar();setLoading(true);
  try{
    const page=await state.pdf.getPage(state.page);
    if(id!==state.renderId)return;
    let viewport=page.getViewport({scale:1,rotation:state.rotation});
    let scale=state.zoom;
    if(state.fitWidth){
      const available=Math.max(280,stage.clientWidth-48);
      scale=available/viewport.width;
    }
    viewport=page.getViewport({scale,rotation:state.rotation});
    const dpr=window.devicePixelRatio||1;
    canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);
    canvas.style.width=Math.floor(viewport.width)+"px";canvas.style.height=Math.floor(viewport.height)+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewport.width,viewport.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    pageWrap.classList.remove("hidden");welcome.classList.add("hidden");
    highlightThumb();
    setStatus("Page "+state.page+" of "+state.pdf.numPages);
    if(!preserveScroll)stage.scrollTop=0;
  }catch(error){console.error(error);toast("Unable to render this page.");setStatus("Render error")}
  finally{if(id===state.renderId)setLoading(false)}
}
function highlightThumb(){
  thumbs.querySelectorAll(".thumb").forEach(node=>node.classList.toggle("active",Number(node.dataset.page)===state.page));
  const active=thumbs.querySelector(".thumb.active");active?.scrollIntoView({block:"nearest"});
}
async function buildThumbnails(){
  thumbs.innerHTML="";
  if(!state.pdf)return;
  const limit=state.pdf.numPages;
  for(let i=1;i<=limit;i++){
    const item=document.createElement("button");item.type="button";item.className="thumb";item.dataset.page=i;
    const c=document.createElement("canvas");item.appendChild(c);
    const label=document.createElement("div");label.className="thumb-label";label.innerHTML="<span>Page "+i+"</span><span>"+(i===state.page?"•":"")+"</span>";item.appendChild(label);
    item.addEventListener("click",()=>{state.page=i;renderPage(i)});
    thumbs.appendChild(item);
    renderThumbnail(i,c).catch(()=>{});
  }
}
async function renderThumbnail(pageNumber,target){
  const page=await state.pdf.getPage(pageNumber);
  const viewport=page.getViewport({scale:1});
  const width=220;const scale=width/viewport.width;const v=page.getViewport({scale});
  const dpr=window.devicePixelRatio||1;
  target.width=Math.floor(v.width*dpr);target.height=Math.floor(v.height*dpr);
  target.style.aspectRatio=v.width+"/"+v.height;
  const c=target.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);
  await page.render({canvasContext:c,viewport:v}).promise;
}
async function loadFile(file){
  if(!file)return;
  if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){toast("Please choose a PDF document.");return}
  setLoading(true);setStatus("Opening "+file.name+"…");
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());
    const task=pdfjsLib.getDocument({data:bytes});
    state.pdf=await task.promise;state.file=file;state.page=1;state.zoom=1;state.rotation=0;state.fitWidth=false;state.textCache.clear();state.searchResults=[];state.searchIndex=-1;
    $("fileName").textContent=file.name;$("docMeta").textContent=(state.pdf.numPages+" page"+(state.pdf.numPages===1?"":"s"))+" • ready to read";
    await buildThumbnails();await renderPage(1);toast("Document ready");
  }catch(error){console.error(error);state.pdf=null;state.file=null;toast("That PDF could not be opened.");setStatus("Could not open document")}
  finally{setLoading(false);updateToolbar()}
}
async function getPageText(pageNumber){
  if(state.textCache.has(pageNumber))return state.textCache.get(pageNumber);
  const page=await state.pdf.getPage(pageNumber);const content=await page.getTextContent();
  const text=content.items.map(item=>item.str||"").join(" ");
  state.textCache.set(pageNumber,text);return text;
}
async function searchDocument(query){
  if(!state.pdf){toast("Open a PDF first.");return}
  query=query.trim().toLowerCase();if(!query){toast("Type something to search.");return}
  setStatus("Searching…");state.searchResults=[];
  for(let i=1;i<=state.pdf.numPages;i++){
    const text=(await getPageText(i)).toLowerCase();
    let from=0;while(true){const at=text.indexOf(query,from);if(at<0)break;state.searchResults.push({page:i,index:at});from=at+query.length}
    if(state.searchResults.length>=200)break;
  }
  if(!state.searchResults.length){toast("No matches found.");setStatus("No search matches");return}
  state.searchIndex=0;state.page=state.searchResults[0].page;await renderPage(state.page);toast(state.searchResults.length+" match"+(state.searchResults.length===1?"":"es")+" found");
}
function cycleSearch(){
  if(!state.searchResults.length)return;
  state.searchIndex=(state.searchIndex+1)%state.searchResults.length;
  renderPage(state.searchResults[state.searchIndex].page);
}
async function printPdf(){
  if(!state.file)return;
  const url=URL.createObjectURL(state.file);const frame=document.createElement("iframe");
  frame.style.position="fixed";frame.style.width="1px";frame.style.height="1px";frame.style.opacity="0";
  frame.src=url;document.body.appendChild(frame);
  frame.onload=()=>{setTimeout(()=>{try{frame.contentWindow.print()}catch{}},250)};
  setTimeout(()=>{URL.revokeObjectURL(url);frame.remove()},60000);
}
function downloadPdf(){if(!state.file)return;const url=URL.createObjectURL(state.file);const a=document.createElement("a");a.href=url;a.download=state.file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function toggleFullscreen(){if(!document.fullscreenElement)$("app").requestFullscreen?.();else document.exitFullscreen?.()}
function openSidebar(){ $("sidebar").classList.toggle("open") }
function wire(){
  $("openButton").onclick=()=>$("fileInput").click();$("welcomeOpen").onclick=()=>$("fileInput").click();
  $("fileInput").onchange=e=>loadFile(e.target.files?.[0]);
  $("sidebarButton").onclick=openSidebar;$("closeSidebar").onclick=openSidebar;
  $("prevButton").onclick=()=>state.page>1&&renderPage(state.page-1);$("nextButton").onclick=()=>state.pdf&&state.page<state.pdf.numPages&&renderPage(state.page+1);
  $("pageInput").onchange=e=>renderPage(e.target.value);
  $("zoomOut").onclick=()=>{state.fitWidth=false;state.zoom-=.1;normalizeZoom();renderPage(state.page,true)};
  $("zoomIn").onclick=()=>{state.fitWidth=false;state.zoom+=.1;normalizeZoom();renderPage(state.page,true)};
  $("zoomReadout").onclick=()=>{state.fitWidth=false;state.zoom=1;renderPage(state.page,true)};
  $("fitButton").onclick=()=>{state.fitWidth=true;renderPage(state.page,true)};
  $("rotateButton").onclick=()=>{state.rotation=(state.rotation+90)%360;renderPage(state.page,true)};
  $("fullscreenButton").onclick=toggleFullscreen;$("printButton").onclick=printPdf;$("downloadButton").onclick=downloadPdf;
  $("themeButton").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("docuv_view_light",document.body.classList.contains("light")?"1":"0")};
  $("searchButton").onclick=()=>searchDocument($("searchInput").value);$("searchInput").onkeydown=e=>{if(e.key==="Enter")searchDocument(e.target.value)};
  $("zoomReadout").title="Click to reset zoom";
  stage.addEventListener("wheel",e=>{if(e.ctrlKey){e.preventDefault();state.fitWidth=false;state.zoom+=e.deltaY<0?.1:-.1;normalizeZoom();renderPage(state.page,true)}},{passive:false});
  ["dragenter","dragover"].forEach(type=>stage.addEventListener(type,e=>{e.preventDefault();stage.classList.add("dragging")}));
  ["dragleave","drop"].forEach(type=>stage.addEventListener(type,e=>{e.preventDefault();stage.classList.remove("dragging")}));
  stage.addEventListener("drop",e=>loadFile(e.dataTransfer?.files?.[0]));
  window.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;
    if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();if(state.pdf&&state.page<state.pdf.numPages)renderPage(state.page+1)}
    if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();if(state.page>1)renderPage(state.page-1)}
    if(e.key==="+")$("zoomIn").click();if(e.key==="-")$("zoomOut").click();
    if(e.key==="f")toggleFullscreen();
    if(e.key==="Escape"&&document.fullscreenElement)document.exitFullscreen();
  });
  if(localStorage.getItem("docuv_view_light")==="1")document.body.classList.add("light");
}
wire();updateToolbar();setStatus("Ready");
