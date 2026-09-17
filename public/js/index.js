let searchBar = document.querySelector(".search");
let input = document.querySelector(".search-input");
let verify = document.querySelector(".v");
let Email = document.querySelector("#Email");
let section = document.querySelector(".verify");
let textarea = document.querySelector(".chat-input");
let send = document.querySelector(".btn");
const chatContainer = document.querySelector(".chat-c");
let userID;
let ws = null;
let receiverId = null;

async function sideNav(id) {
  let pId = id;
  console.log("exectuiting");
  let result = await fetch(`/Profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: pId }),
  });
  let value = await result.json();
  // console.log(value);
  document.querySelector(".p-pic").src = value.data[0].url;
  document.querySelector(".profile-name").innerText =
    `${value.data[0].first_name} ${value.data[0].last_name}`;
}

document.querySelector(".chat-content").style.height =
  `${document.querySelector(".chat").clientHeight - document.querySelector(".chat-util").offsetHeight}px`;

verify.addEventListener("click", async () => {
  const email = Email.value;
  verification(email);
});

Email.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const email = Email.value;
    verification(email);
  }
});

async function LoadMemberList(userId) {
  const id = userId;
  let result = await fetch(`/status`, {
    method: "GET",
    credentials: "include",
  });
  let value = await result.json();

  let data = value.data;
  // console.log(data);

  let a = "";

  data.forEach((el) => {
    if (el.userId !== id) {
      a += `<div class="p" data-userid="${el.userId}">
                <div class="p-pic">
                  <img src="${el.url}" alt="" />
                </div>
                <div class="p-name">${el.first_name} ${el.last_name} <div class="status-${el.status}"></div> </div>
                <div class="p-status">
                  
                 
                 <div class="unread"></div>
                </div>
                
              </div>`;
    }
  });
  document.querySelector(".member-list").innerHTML = a;

  await updateUnreadCounts(id);
}

async function updateUnreadCounts(userId) {
  const response = await fetch("/unread-count", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: userId,
    }),
  });
  let unread = await response.json();
  let unreadData = unread.data;
  // console.log(unreadData);

  if (unreadData.length !== 0) {
    unreadData.forEach((el) => {
      const member = document.querySelector(
        `.p[data-userid="${el.sender_id}"]`,
      );
      if (member) {
        if (el.unread_count > 0) {
          member.querySelector(".unread").style.display = "block";
          member.querySelector(".unread").textContent = el.unread_count;
        }
      }
    });
    return;
  }
  document.querySelectorAll(".unread").forEach((el) => {
    el.style.display = "none";
  });
}

// ws.addEventListener("open", () => {
//   console.log("WebSocket connection opened");
// });

input.addEventListener("mouseover", () => {
  searchBar.classList.add("hover");
});

input.addEventListener("mouseout", () => {
  if (searchBar.classList.contains("hover")) {
    searchBar.classList.remove("hover");
  }
});

input.addEventListener("focus", () => {
  if (searchBar.classList.contains("hover")) {
    searchBar.classList.remove("hover");
  }
  searchBar.classList.add("active");
});

input.addEventListener("blur", () => {
  searchBar.classList.remove("active");
});

textarea.addEventListener("input", () => {
  if (textarea.scrollHeight <= 100) {
    textarea.style.overflow = "hidden";
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    document.querySelector(".chat-content").style.height =
      `${document.querySelector(".chat").clientHeight - document.querySelector(".chat-util").offsetHeight}px`;
  } else {
    textarea.style.overflow = "scroll";
  }
});

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    console.log("New width:", entry.contentRect.width);
    if (textarea.scrollHeight <= 100) {
      textarea.style.overflow = "hidden";
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    } else {
      textarea.style.overflow = "scroll";
    }
  }
});

observer.observe(textarea);

// send.addEventListener("click", () => {
//   console.log("clicked");
//   if (textarea.value.trim() !== "") {
//     let msgUser = ` <div>
//                   <div class="c-user flex">
//                     <div class="c-user-text">${textarea.value}</div>
//                     <div class="c-pic">
//                       <img src="./assest/p2.jpg" alt="" />
//                     </div>
//                   </div>
//                 </div>
//                 `;

//     document.querySelector(".chat-c").innerHTML = msgUser;
//   }
// });

// document.querySelector(".chat-input").addEventListener("keypress", (e) => {
//   if (e.key === "Enter") {
//     console.log("pressed");

//     if (textarea.value.trim() !== "") {
//       let msgNonUser = `<div class="bubble">
//                   <div class="c-nonuser flex">
//                     <div class="c-pic">
//                       <img src="./assest/p1.jpeg" alt="" />
//                     </div>
//                     <div class="c-user-text">${textarea.value}</div>
//                   </div>
//                 </div>`;
//       document.querySelector(".chat-c").innerHTML = msgNonUser;
//     }
//   }
// });

async function refreshChat(data, receiverId, userID) {
  if (
    Number(userID) === data.senderId ||
    Number(receiverId) === data.senderId
  ) {
    if (data.senderId === userID) {
      let msgUser = ` <div>
                  <div class="c-user flex">
                    <div class="c-user-text">${data.msg}</div>
                    
                  </div>
                </div>
                `;
      chatContainer.insertAdjacentHTML("beforeend", msgUser);
    } else if (data.senderId !== userID) {
      let msgNonUser = `<div class="bubble">
                  <div class="c-nonuser flex">
                    
                    <div class="c-user-text">${data.msg}</div>
                  </div>
                </div>`;
      chatContainer.insertAdjacentHTML("beforeend", msgNonUser);
    }
  } else {
    await updateUnreadCounts(userID);
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

document.querySelector(".member-list").addEventListener("click", (e) => {});

send.addEventListener("click", async (e) => {
  const msg = textarea.value.trim();
  if (msg === "") return;

  try {
    ws.send(JSON.stringify({ Receiver: receiverId, cmt: msg }));
    textarea.value = "";
  } catch (error) {
    console.error("Error:", error);
  }
});

textarea.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const msg = textarea.value.trim();
    if (msg === "") return;

    try {
      ws.send(JSON.stringify({ Receiver: receiverId, cmt: msg }));
      textarea.value = "";
    } catch (error) {
      console.error("Error:", error);
    }
  }
});

async function verification(email) {
  //  const email = Email.value;
  if (email.trim() === "") {
    console.log("email is empty");
    return;
  }
  console.log("Email:", email);

  const response = await fetch("/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
    }),
  });

  const data = await response.json();
  console.log(data);
  userID = data.userId;
  if (data.access) {
    section.style.display = "none";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${window.location.host}`);
    ws.addEventListener("open", () => {
      console.log("WebSocket connection opened");
      ws.send(
        JSON.stringify({
          type: "identify",
          userId: `${data.userId}`,
        }),
      );
    });
    ws.addEventListener("message", (event) => {
      let result = JSON.parse(event.data);
      console.log(result.type);
      if (result.type === "chatMessage") {
        console.log(
          `Received chat message from user ${result.senderId}: ${result.msg} (message ID: ${result.messageId})`,
        );

        refreshChat(result, receiverId, userID);
      } else if (result.type === "statusUpdate") {
        console.log(result);
        console.log("Verification successful");
        LoadMemberList(data.userId);
        sideNav(data.userId);
      }
    });
  } else {
    console.log("Verification failed");
  }
}

// ws.addEventListener("message", (event) => {
//   let result = event.data;
//   console.log(result);
//   console.log(userID);
//   LoadMemberList(userID);
// });

async function relevantChat() {
  let u = `<div>
                  <div class="c-user flex">
                    <div class="c-user-text">I am fine.</div>
                    <div class="c-pic">
                      <img src="./assest/p2.jpg" alt="" />
                    </div>
                  </div>
                </div>
                `;
  let nu = `<div class="bubble">
                  <div class="c-nonuser flex">
                    <div class="c-pic">
                      <img src="./assest/p1.jpeg" alt="" />
                    </div>
                    <div class="c-user-text">Hello, how are you?</div>
                  </div>
                </div>`;
}
// ----------------------------------------
let wrapper = document.querySelector(".member-list");

wrapper.addEventListener("click", async (e) => {
  e.stopPropagation();

  const member = e.target.closest(".p");
  const memberPic = e.target.closest(".p-pic");

  if (memberPic) {
    console.log("pic clicked");
    return;
  }

  if (member) {
    receiverId = member.dataset.userid;

    let name = member.querySelector(".p-name").innerHTML;
    document.querySelector("#c-name").innerHTML = name;

    await resetUnreadCount(userID, receiverId);
    await fetchChat(userID, receiverId);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    document.querySelector(".chat-cover").style.display = "none";

    return;
  }
});

async function resetUnreadCount(userId, receiverId) {
  console.log(
    "Resetting unread count for userId:",
    userId,
    "receiverId:",
    receiverId,
  );
  try {
    const response = await fetch("/reset-unread", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userId,
        receiverId: receiverId,
      }),
    });

    const result = await response.json();

    if (result.message === "successfully") {
      const member = document.querySelector(`.p[data-userid="${receiverId}"]`);
      member.querySelector(".unread").style.display = "none";
      console.log("Unread count reset successfully");
    }
  } catch (error) {
    console.error("Error resetting unread count:", error);
  }
}

async function fetchChat(userId, receiverId) {
  chatContainer.innerHTML = `<div class="spacer"></div>`;
  let msgUser = "";
  let msgNonUser = "";

  const response = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      senderId: userId,
      receiverId: receiverId,
    }),
  });

  const data = await response.json();
  console.log(data);

  data.forEach((data) => {
    if (data.sender_id === userID) {
      msgUser = ` <div>
                  <div class="c-user flex">
                    <div class="c-user-text">${data.content}</div>
                    
                  </div>
                </div>
                `;
      chatContainer.insertAdjacentHTML("beforeend", msgUser);
    } else if (data.sender_id !== userID) {
      msgNonUser = `<div class="bubble">
                  <div class="c-nonuser flex">
                    
                    <div class="c-user-text">${data.content}</div>
                  </div>
                </div>`;
      chatContainer.insertAdjacentHTML("beforeend", msgNonUser);
    }
  });
}

document.querySelector(".js-upload").addEventListener("change", showImage);

function showImage() {
  const img = document.querySelector(".js-upload-img");
  const input_files = document.querySelector(".js-upload");

  let file = input_files.files[0];
  if (!file) return;

  const maxSize = 5 * 1024 * 1024;

  if (!file.type.startsWith("image/"))
    return alert("Only image files are allowed");
  if (file.size > maxSize) return alert("File is too large. Max size is 5MB");

  const path = URL.createObjectURL(file);

  img.src = path;
  img.onload = () => URL.revokeObjectURL(path);
}

document.querySelector(".js-upload-btn").addEventListener("click", async () => {
  const img = document.querySelector(".js-upload-img");
  const input_files = document.querySelector(".js-upload");

  let file = input_files.files[0];
  if (!file) return alert("File is required");

  const maxSize = 5 * 1024 * 1024;

  if (!file.type.startsWith("image/"))
    return alert("Only image files are allowed");
  if (file.size > maxSize) return alert("File is too large. Max size is 5MB");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("id", userID);

  try {
    const res = await fetch("/image", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }
    input_files.value = "";
    img.src = "";
    const result = await res.json();
    console.log(result);
    await sideNav(userID);
  } catch (err) {
    console.error("Error uploading image: ", err);
  }
});

document.querySelector(".close").addEventListener("click", () => {
  document.querySelector(".model-edit").style.display = "none";
});

document.querySelector(".p-edit").addEventListener("click", () => {
  document.querySelector(".model-edit").style.display = "flex";
});
