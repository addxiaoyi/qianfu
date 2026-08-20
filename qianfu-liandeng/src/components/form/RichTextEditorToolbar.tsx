import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Link as LinkIcon, Image as ImageIcon, Heading1, Heading2, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, 
  Trash2, Code, Palette
} from 'lucide-react';
import { useT } from '@/store/uiStore';

interface RichTextEditorToolbarProps {
  editor: Editor;
  onOpenDialog: (type: 'image' | 'link' | 'color') => void;
}

interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

const MenuButton = React.memo(({ onClick, isActive = false, disabled = false, children, title }: MenuButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg transition-all duration-300 flex items-center justify-center ${
      isActive ? 'bg-black text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-100 hover:text-black'
    } disabled:opacity-20`}
  >
    {children}
  </button>
));

const RichTextEditorToolbar: React.FC<RichTextEditorToolbarProps> = ({ editor, onOpenDialog }) => {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-1 p-3 border-b border-zinc-100 bg-zinc-50/50 backdrop-blur-md sticky top-0 z-20">
      <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title={t('editor.toolbar.bold')}>
        <Bold className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title={t('editor.toolbar.italic')}>
        <Italic className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title={t('editor.toolbar.underline')}>
        <UnderlineIcon className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title={t('editor.toolbar.strike')}>
        <Strikethrough className="w-4 h-4" />
      </MenuButton>

      <div className="w-px h-6 bg-zinc-200 mx-2" />

      <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title={t('editor.toolbar.h1')}>
        <Heading1 className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title={t('editor.toolbar.h2')}>
        <Heading2 className="w-4 h-4" />
      </MenuButton>

      <div className="w-px h-6 bg-zinc-200 mx-2" />

      <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title={t('editor.toolbar.bullet')}>
        <List className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title={t('editor.toolbar.ordered')}>
        <ListOrdered className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title={t('editor.toolbar.code')}>
        <Code className="w-4 h-4" />
      </MenuButton>

      <div className="w-px h-6 bg-zinc-200 mx-2" />

      <MenuButton onClick={() => onOpenDialog('color')} isActive={editor.isActive('textStyle', { color: '#000000' })} title={t('editor.toolbar.color')}>
        <Palette className="w-4 h-4" />
      </MenuButton>

      <div className="w-px h-6 bg-zinc-200 mx-2" />

      <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title={t('editor.toolbar.align.left')}>
        <AlignLeft className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title={t('editor.toolbar.align.center')}>
        <AlignCenter className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title={t('editor.toolbar.align.right')}>
        <AlignRight className="w-4 h-4" />
      </MenuButton>

      <div className="w-px h-6 bg-zinc-200 mx-2" />

      <MenuButton onClick={() => onOpenDialog('link')} isActive={editor.isActive('link')} title={t('editor.toolbar.link')}>
        <LinkIcon className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => onOpenDialog('image')} title={t('editor.toolbar.image')}>
        <ImageIcon className="w-4 h-4" />
      </MenuButton>

      <div className="md:ml-auto flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-zinc-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 italic">
          <span>{t('editor.toolbar.stats.chars')}: {editor.storage.characterCount.characters()}</span>
          <span className="opacity-20">|</span>
          <span>{t('editor.toolbar.stats.words')}: {editor.storage.characterCount.words()}</span>
        </div>
        <MenuButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title={t('editor.toolbar.clear')}>
          <Trash2 className="w-4 h-4" />
        </MenuButton>
      </div>
    </div>
  );
};

export default React.memo(RichTextEditorToolbar);
