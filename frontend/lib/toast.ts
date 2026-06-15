export const showPointsToast = (points: number, customText?: string) => {
  if (typeof window === 'undefined') return;
  const toast = document.createElement("div");
  toast.className = "fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-fade-in";
  toast.style.animation = "fadeIn 0.2s ease-out";
  toast.innerHTML = customText ? `🏆 ${customText}` : `🏆 +${points} points!`;
  
  // Add keyframe animation if not exists
  if (!document.getElementById("toast-animation-style")) {
    const style = document.createElement("style");
    style.id = "toast-animation-style";
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out";
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 3000);
};
