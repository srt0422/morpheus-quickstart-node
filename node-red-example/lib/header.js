// // Preserve console logs
// console.clear = function() {};  // Prevent console clearing
// console.debug("Header script loading...");

// RED.events.on("runtime-event", function(event) {
//     console.debug("[Header] Runtime event:", event);
// });

// RED.events.on("editor:open", function() {
//     console.debug("[Header] Editor opened, updating header...");
//     updateHeader();
// });

// function updateHeader() {
//     console.debug("[Header] Attempting to update header...");
//     var header = document.querySelector(".red-ui-header-logo");
    
//     if (!header) {
//         console.debug("[Header] Header element not found, retrying in 500ms...");
//         setTimeout(updateHeader, 500);
//         return;
//     }

//     console.debug("[Header] Found header element:", header);
//     header.innerHTML = "";

//     var newHeaderImage = document.createElement("img");
//     newHeaderImage.src = "/logo.png";
//     newHeaderImage.style.height = "30px";
//     newHeaderImage.style.marginRight = "10px";
//     newHeaderImage.onerror = function() {
//         console.debug("[Header] Failed to load logo image");
//     };
//     newHeaderImage.onload = function() {
//         console.debug("[Header] Logo image loaded successfully");
//     };

//     var newHeaderTitle = document.createElement("span");
//     newHeaderTitle.textContent = "Morpheus";
//     newHeaderTitle.style.fontSize = "20px";
//     newHeaderTitle.style.verticalAlign = "middle";

//     header.appendChild(newHeaderImage);
//     header.appendChild(newHeaderTitle);
//     console.debug("[Header] Header updated successfully");
// }

// // Initial attempt after DOM is ready
// if (document.readyState === "complete") {
//     console.debug("[Header] Document already complete, starting update...");
//     setTimeout(updateHeader, 1000);
// } else {
//     console.debug("[Header] Waiting for DOMContentLoaded...");
//     document.addEventListener("DOMContentLoaded", function() {
//         console.debug("[Header] DOMContentLoaded fired, starting update...");
//         setTimeout(updateHeader, 1000);
//     });
// }