const Config = {
  Endpoint: "/api/analyze",
  StorageKey: "FridgeHelperUsualList"
};

const UsualInput = document.getElementById("UsualInput");
const SaveUsualBtn = document.getElementById("SaveUsualBtn");
const FridgeImage = document.getElementById("FridgeImage");
const Preview = document.getElementById("Preview");
const AnalyzeBtn = document.getElementById("AnalyzeBtn");
const Status = document.getElementById("Status");
const ResultList = document.getElementById("ResultList");

function SetStatus(message) {
  Status.textContent = message;
}

function LoadUsualList() {
  UsualInput.value = localStorage.getItem(Config.StorageKey) || "";
}

function SaveUsualList() {
  localStorage.setItem(Config.StorageKey, UsualInput.value);
  SetStatus("List saved!");
}

function ShowPreview() {
  const file = FridgeImage.files[0];
  if (!file) {
    Preview.hidden = true;
    return;
  }
  Preview.src = URL.createObjectURL(file);
  Preview.hidden = false;
}

function ReadFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function BuildPrompt(usualList) {
  return `You are a grocery assistant. The user's usual grocery list is:
${usualList}

Look at the fridge photo. Compare it to the usual list.
Return ONLY a JSON array of strings with the items from the usual list that are missing or running low in the fridge.
If you can see other obvious essentials missing, you may add them too.
No other text.`;
}

function RenderList(items) {
  ResultList.innerHTML = "";

  if (items.length === 0) {
    SetStatus("Fridge looks stocked. Nothing to buy!");
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    checkbox.type = "checkbox";
    text.textContent = item;

    checkbox.addEventListener("change", () => {
      text.classList.toggle("Done", checkbox.checked);
    });

    label.appendChild(checkbox);
    label.appendChild(text);
    li.appendChild(label);
    ResultList.appendChild(li);
  });

  SetStatus(`Found ${items.length} item(s) to buy.`);
}

async function AnalyzeFridge() {
  const file = FridgeImage.files[0];
  const usualList = UsualInput.value.trim();

  if (!file) return SetStatus("Pick a fridge photo first.");
  if (!usualList) return SetStatus("Save your usual list first.");

  SetStatus("Analyzing fridge...");
  AnalyzeBtn.disabled = true;

  try {
    const imageBase64 = await ReadFileAsBase64(file);

    const response = await fetch(Config.Endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: BuildPrompt(usualList),
        imageBase64: imageBase64,
        mimeType: file.type || "image/jpeg"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const Message = data.error?.message || data.error || `Status ${response.status}`;
      SetStatus(`Error: ${typeof Message === "string" ? Message : JSON.stringify(Message)}`);
      return;
    }

    if (!data.candidates || !data.candidates[0]) {
      SetStatus("No answer from AI. Check the console.");
      console.log(data);
      return;
    }
    const text = data.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(cleanText);

    RenderList(items);
  } catch (error) {
    console.error(error);
    SetStatus("Something went wrong. Check the console.");
  } finally {
    AnalyzeBtn.disabled = false;
  }
}

SaveUsualBtn.addEventListener("click", SaveUsualList);
FridgeImage.addEventListener("change", ShowPreview);
AnalyzeBtn.addEventListener("click", AnalyzeFridge);

LoadUsualList();