let editor;

initEditor();

function initEditor(){

  editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    fromElement: false,

    storageManager: false,

    panels: {
      defaults: [
        {
          id: "basic-actions",
          el: ".editor-actions",
          buttons: []
        }
      ]
    },

    blockManager: {
      appendTo: "body", // 👈 TEMP so you can SEE it
      blocks: [
        {
          id: "text",
          label: "Text",
          content: `<p>Edit this text</p>`
        },
        {
          id: "button",
          label: "Button",
          content: `<a class="main-btn">Click Me</a>`
        },
        {
          id: "section",
          label: "Section",
          content: `<section style="padding:50px;text-align:center;">
                      <h2>New Section</h2>
                      <p>Edit me</p>
                    </section>`
        }
      ]
    }
  });

  // 🔥 THIS WAS MISSING — load starter page
  editor.setComponents(`
    <section style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;background:#0B0B0F;color:white;">
      <div>
        <h1>Click to Edit This</h1>
        <p>This is your live editor working.</p>
        <a style="display:inline-block;margin-top:20px;padding:12px 24px;background:#7B5CFF;color:white;border-radius:30px;">Button</a>
      </div>
    </section>
  `);

}
