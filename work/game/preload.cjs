const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{load:()=>ipcRenderer.invoke('save:load'),save:data=>ipcRenderer.invoke('save:write',data),fullscreen:()=>ipcRenderer.invoke('window:fullscreen')});
