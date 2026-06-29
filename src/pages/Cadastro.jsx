import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { uploadArquivoCloudinary } from '../services/cloudinary'
import './Admin.css'

const PERMISSOES_MEMBRO = ['meusDados']

function Cadastro() {
  const [cadastroMembroForm, setCadastroMembroForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    nascimento: '',
    endereco: '',
    ministerio: '',
    senha: '',
    confirmarSenha: '',
    foto: '',
    fotoPublicId: '',
  })
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [enviandoFotoCadastro, setEnviandoFotoCadastro] = useState(false)

async function enviarFotoCadastroMembro(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoFotoCadastro(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setCadastroMembroForm((formAtual) => ({
      ...formAtual,
      foto: arquivo.url,
      fotoPublicId: arquivo.publicId,
    }))

    event.target.value = ''
  } catch (error) {
    console.error('Erro ao enviar foto do cadastro.', error)
    alert('Não foi possível enviar a foto. Tente novamente.')
  } finally {
    setEnviandoFotoCadastro(false)
  }
}

  async function cadastrarMembroPendente(event) {
    event.preventDefault()

    if (!cadastroMembroForm.nome.trim()) {
      alert('Informe seu nome completo.')
      return
    }

    if (!cadastroMembroForm.email.trim()) {
      alert('Informe seu e-mail.')
      return
    }

    if (cadastroMembroForm.senha.length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (cadastroMembroForm.senha !== cadastroMembroForm.confirmarSenha) {
      alert('As senhas não conferem.')
      return
    }

    setLoading(true)

    try {
      const credencial = await createUserWithEmailAndPassword(
        auth,
        cadastroMembroForm.email.trim().toLowerCase(),
        cadastroMembroForm.senha,
      )

      const membroRef = doc(collection(db, 'membros'))
      const permissaoRef = doc(db, 'usuariosPermissoes', credencial.user.uid)
      const batch = writeBatch(db)

      const dadosMembro = {
        nome: cadastroMembroForm.nome.trim(),
        email: cadastroMembroForm.email.trim().toLowerCase(),
        telefone: cadastroMembroForm.telefone.trim(),
        nascimento: cadastroMembroForm.nascimento,
        endereco: cadastroMembroForm.endereco.trim(),
        ministerio: cadastroMembroForm.ministerio.trim(),
        foto: cadastroMembroForm.foto,
        fotoPublicId: cadastroMembroForm.fotoPublicId,
        status: 'Pendente aprovação',
        origemCadastro: 'autoCadastro',
        usuarioUid: credencial.user.uid,
        ativo: false,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }

      const dadosPermissao = {
        uid: credencial.user.uid,
        nome: cadastroMembroForm.nome.trim(),
        email: cadastroMembroForm.email.trim().toLowerCase(),
        perfil: 'membro',
        membroId: membroRef.id,
        ativo: false,
        permissoes: PERMISSOES_MEMBRO,
        origemCadastro: 'autoCadastro',
        aguardandoAprovacao: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }

      batch.set(membroRef, dadosMembro)
      batch.set(permissaoRef, dadosPermissao)

      await batch.commit()

      setCadastroMembroForm({
        nome: '',
        email: '',
        telefone: '',
        nascimento: '',
        endereco: '',
        ministerio: '',
        senha: '',
        confirmarSenha: '',
        foto: '',
        fotoPublicId: '',
      })

      setEnviado(true)
    } catch (error) {
      console.error('Erro ao solicitar cadastro de membro.', error)

      if (error.code === 'auth/email-already-in-use') {
        alert(
          'Este e-mail já possui cadastro. Faça login ou fale com a liderança.',
        )
        return
      }

      if (error.code === 'auth/weak-password') {
        alert('A senha precisa ter pelo menos 6 caracteres.')
        return
      }

      alert('Não foi possível enviar seu cadastro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <main className="admin-page">
        <section className="login-card">
        <div className="admin-logo cadastro-logo-marca">
  <img src="/Filhosdagraça.png" alt="Filhos da Graça" />
</div>
          <h1>Cadastro enviado</h1>
          <p>
            Recebemos seu cadastro. A liderança fará a aprovação antes da
            liberação do acesso. Você será avisado quando estiver tudo certo.
          </p>
          <a href="/">
            <button type="button">Voltar para a página inicial</button>
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <section className="login-card">
       <div className="admin-logo cadastro-logo-marca">
  <img src="/Filhosdagraça.png" alt="Filhos da Graça" />
</div>

<div className="cadastro-photo-top">
  <div className="cadastro-photo-avatar">
    {cadastroMembroForm.foto ? (
      <img src={cadastroMembroForm.foto} alt="Foto do cadastro" />
    ) : (
      <span>Foto</span>
    )}
  </div>

  <label className="cadastro-photo-button">
    {enviandoFotoCadastro ? 'Enviando...' : 'Selecionar foto'}

    <input
      type="file"
      accept="image/*"
      onChange={enviarFotoCadastroMembro}
      disabled={enviandoFotoCadastro}
    />
  </label>
</div>

<h1>Cadastro de membro</h1>
        <p>
          Solicite seu acesso. A liderança fará a aprovação antes da liberação.
        </p>

        <form
          className="member-signup-form"
          onSubmit={cadastrarMembroPendente}
        >
          <label>
            Nome completo
            <input
              value={cadastroMembroForm.nome}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  nome: event.target.value,
                })
              }
              placeholder="Seu nome"
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={cadastroMembroForm.email}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  email: event.target.value,
                })
              }
              placeholder="seuemail@exemplo.com"
            />
          </label>

          <label>
            Telefone ou WhatsApp
            <input
              value={cadastroMembroForm.telefone}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  telefone: event.target.value,
                })
              }
              placeholder="(00) 00000-0000"
            />
          </label>

          <label>
            Nascimento
            <input
              type="date"
              value={cadastroMembroForm.nascimento}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  nascimento: event.target.value,
                })
              }
            />
          </label>

          <label>
            Ministério
            <input
              value={cadastroMembroForm.ministerio}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  ministerio: event.target.value,
                })
              }
              placeholder="Opcional"
            />
          </label>

          <label>
            Endereço
            <textarea
              value={cadastroMembroForm.endereco}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  endereco: event.target.value,
                })
              }
              placeholder="Opcional"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={cadastroMembroForm.senha}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  senha: event.target.value,
                })
              }
              placeholder="Mínimo 6 caracteres"
            />
          </label>

          <label>
            Confirmar senha
            <input
              type="password"
              value={cadastroMembroForm.confirmarSenha}
              onChange={(event) =>
                setCadastroMembroForm({
                  ...cadastroMembroForm,
                  confirmarSenha: event.target.value,
                })
              }
              placeholder="Repita a senha"
            />
          </label>

          <button type="submit" disabled={loading || enviandoFotoCadastro}>
            {loading || enviandoFotoCadastro ? 'Enviando...' : 'Solicitar cadastro'}
          </button>
        </form>

       <a href="/admin" className="cadastro-login-link">
  Já tem cadastro? Entrar
</a>
      </section>
    </main>
  )
}

export default Cadastro
