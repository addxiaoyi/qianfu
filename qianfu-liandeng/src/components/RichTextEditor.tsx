import React, { useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { CharacterCount } from '@tiptap/extension-character-count';
import { common, createLowlight } from 'lowlight';
import { 
  Link as LinkIcon, Image as ImageIcon, 
  Palette, Plus, Minus, Trash2
} from 'lucide-react';
import { useT } from '@/store/uiStore';
import MatrixDialog from './MatrixDialog';
import RichTextEditorToolbar from './RichTextEditorToolbar';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const t = useT();
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'image' | 'link' | 'color';
    defaultValue: string;
  }>({ isOpen: false, type: 'image', defaultValue: '' });

  const editorExtensions = useMemo(() => ([
    StarterKit.configure({ codeBlock: false }),
    Underline,
    Link.configure({ openOnClick: false }),
    Image,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    TextStyle,
    Color,
    CharacterCount,
  ]), []);

  const editor = useEditor({
    extensions: editorExtensions,
    
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-zinc max-w-none focus:outline-none min-h-[400px] px-12 py-12 italic font-bold text-lg leading-relaxed selection:bg-accent selection:text-white',
      },
    },
  });

  if (!editor) return null;

  const handleDialogSubmit = (val: string) => {
    if (dialogState.type === 'image') {
      if (val) editor.chain().focus().setImage({ src: val }).run();
    } else if (dialogState.type === 'link') {
      if (val) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: val }).run();
      } else {
        editor.chain().focus().unsetLink().run();
      }
    } else if (dialogState.type === 'color') {
      if (val) editor.chain().focus().setColor(val).run();
    }
  };

  return (
    <div className="matrix-card !p-0 overflow-hidden group/editor">
      <RichTextEditorToolbar editor={editor} onOpenDialog={(type) => {
        if (type === 'color') setDialogState({ isOpen: true, type, defaultValue: '#000000' });
        else if (type === 'link') setDialogState({ isOpen: true, type, defaultValue: editor.getAttributes('link').href || '' });
        else setDialogState({ isOpen: true, type, defaultValue: '' });
      }} />

      {/* Editor Content */}
      <div className="relative group min-h-[280px]">
        {!editor.getHTML().replace(/<[^>]*>?/gm, '').trim() && (
          <div className="absolute top-4 left-4 text-zinc-300 font-black italic pointer-events-none transition-opacity group-focus-within:opacity-0 text-lg uppercase tracking-tighter opacity-40">
            {placeholder || 'INITIALIZING_CONTENT_STREAM...'}
          </div>
        )}
        <EditorContent editor={editor} />
        
        {/* Table Toolbar (Floating when inside table) */}
        {editor.isActive('table') && (
           <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-3 bg-white border border-zinc-100 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
              <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="p-3 hover:bg-zinc-50 rounded-xl transition-colors" title="Add Column Before"><Plus className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().deleteColumn().run()} className="p-3 hover:bg-red-50 text-red-500 rounded-xl transition-colors" title="Delete Column"><Minus className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="p-3 hover:bg-zinc-50 rounded-xl transition-colors" title="Add Column After"><Plus className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-zinc-200 mx-2" />
              <button onClick={() => editor.chain().focus().addRowBefore().run()} className="p-3 hover:bg-zinc-50 rounded-xl transition-colors" title="Add Row Before"><Plus className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().deleteRow().run()} className="p-3 hover:bg-red-50 text-red-500 rounded-xl transition-colors" title="Delete Row"><Minus className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().addRowAfter().run()} className="p-3 hover:bg-zinc-50 rounded-xl transition-colors" title="Add Row After"><Plus className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-zinc-200 mx-2" />
              <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-3 hover:bg-black text-white rounded-xl transition-colors" title="Delete Table"><Trash2 className="w-4 h-4" /></button>
           </div>
        )}
      </div>

      <MatrixDialog 
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState({ ...dialogState, isOpen: false })}
        onSubmit={handleDialogSubmit}
        title={
          dialogState.type === 'image' ? t('editor.toolbar.image') : 
          dialogState.type === 'link' ? t('editor.toolbar.link') : 
          t('editor.toolbar.color')
        }
        placeholder={
          dialogState.type === 'image' ? 'HTTPS://URL_TO_IMAGE.JPG' : 
          dialogState.type === 'link' ? 'HTTPS://TARGET_URL.LOCAL' : 
          '#HEX_COLOR_CODE'
        }
        defaultValue={dialogState.defaultValue}
        icon={
          dialogState.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : 
          dialogState.type === 'link' ? <LinkIcon className="w-3.5 h-3.5" /> : 
          <Palette className="w-3.5 h-3.5" />
        }
      />
    </div>
  );
};

export default RichTextEditor;
