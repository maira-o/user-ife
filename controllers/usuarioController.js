const Joi               = require('joi');
const emailValidator    = require('email-validator');
const bcrypt            = require('bcryptjs');
const Usuario           = require('../models/Usuario');
const educadorService   = require('../services/educador');
const criancaService    = require('../services/crianca');

exports.buscaUsuario = async (req, res) => {
    usuarioId = req.params.id
    // userLoggedId = req.user._id
    // userLoggedId = usuarioId // >>> APAGAR <<<
    userLoggedId = req.headers.userid

    try {
        if(usuarioId != userLoggedId){
            // 403 Forbidden
            return res.status(403).send({ status: 403, message: 'Acesso negado' });
        }
        let usuario = await Usuario.findOne({ _id: usuarioId }).exec();
        if(!usuario){
            // 204 No Content
            return res.status(204).send({ status: 204, message: 'Usuário não encontrado' });
        }
        // 200 OK
        switch (usuario.papel) {
            case 1:
                result = await educadorService.buscaReduzidaEducador(usuario._id)
                if (result.status === 200) {
                    let copia = JSON.parse(JSON.stringify(usuario));
                    copia.educador = result.data.educador
                    usuario = copia
                }
                break;
            case 2:
                /* console.log(req) */
                result = await criancaService.buscaReduzidaCrianca(req, usuario._id)
                if (result.status === 200) {
                    let copia = JSON.parse(JSON.stringify(usuario));
                    copia.crianca = result.data.crianca
                    usuario = copia
                }
                break;
            case 3:
                console.log("buscaUsuario > buscaReduzidaApoiador >>>")
                result = { status: 200, data: { message: 'Sucesso' } }
                break;
            default: // 406 Not Acceptable
                return res.status(406).send({ status: 406, message: "Usuário não classificado" });
        }
        switch (result.status) {
            case 204: // 204 No Content
                res.status(result.status).send({ status: result.status, message: result.data.message });
                break;
            case 200: // 200 OK
                res.status(result.status).send({ status: result.status, message: result.data.message, usuario: usuario });
                break;
            default:
                console.log("buscaUsuario > 200 > default > result >>>")
                console.log(result)
                // 500 Internal Server Error
                res.status(500).send({ status: 500, message: "Erro ao buscar uauário" });
        }
    } catch (err){
        console.log("buscaUsuario > err >>>")
        console.log(err)
        // 500 Internal Server Error
        res.status(500).send({ status: 500, message: "Erro ao buscar Usuário" });
    }
}

exports.buscaReduzidaUsuario = async (req, res) => {
    usuarioId = req.params.id
    try {
        const usuario = await Usuario.findOne({ _id: usuarioId }).exec();
        if(!usuario){
            // 204 No Content
            return res.status(204).send({ status: 204, message: 'Usuário não encontrado' });
        }
        // 200 OK
        return res.status(200).send({ status: 200, message: 'Sucesso', usuario: usuario });
    } catch (err){
        console.log("buscaReduzidaUsuario > err >>>")
        console.log(err)
        // 500 Internal Server Error
        res.status(500).send({ status: 500, message: "Erro ao buscar Usuário" });

    }
}

exports.novoUsuario = async (req, res) => {
    try {
        const { nome, email, senha, confirmaSenha, papel } = req.body
        const usuarioReq = {
            nome:           nome,
            email:          email,
            senha:          senha,
            confirmaSenha:  confirmaSenha,
            papel:          papel
        }

        let { error } = await validaUsuario(usuarioReq);
        if(error){
            console.log("novoUsuario > validaUsuario > error >>>")
            console.log(error.details[0].message)
            // 406 Not Acceptable
            return res.status(406).send({ status: 406, message: 'O objeto enviado é inválido (dados do usuário)' });
        }

        let criancaReq = {}
        if (papel === 2) {
            const { dt_nasc, ano_escolar, cidade, uf, telefone, observacoes, nivel_leitura } = req.body
            //userId = '61873f5d6212a24abe8dd210' // >>> APAGAR <<<
            criancaReq = {
                dt_nasc:        dt_nasc,
                ano_escolar:    ano_escolar,
                cidade:         cidade,
                uf:             uf,
                telefone:       telefone,
                observacoes:    observacoes,
                nivel_leitura:  nivel_leitura,
                educadorUsrId:  req.headers.userid // userId    // id do usuário logado (req.user._id)
            }
            let { error } = await validaCrianca(criancaReq);
            if(error){
                console.log("novoUsuario > validaCrianca > error >>>")
                console.log(error.details[0].message)
                console.log(criancaReq)
                // 406 Not Acceptable
                return res.status(406).send({ status: 406, message: 'O objeto enviado é inválido (dados da criança)' });
            }
        }

        const emailLowerCase = email.toLowerCase();
        if(!isEmail(emailLowerCase)){
            // 400 Bad Request
            return res.status(400).send({ status: 400, message: 'Endereço de e-mail inválido' });
        }

        if(senha !== confirmaSenha){
            // 400 Bad Request
            return res.status(400).send({ status: 400, message: 'Senhas não conferem' });
        }

        const emailExiste = await Usuario.findOne({ email: emailLowerCase });
        if(emailExiste) {
            // 400 Bad Request
            return res.status(400).send({ status: 400, message: 'E-mail já cadastrado' });
        }

        const salt          = await bcrypt.genSalt(10);
        const hashSenha     = await bcrypt.hash(senha, salt);
        const novoUsuario   = new Usuario({
            nome:   nome,
            email:  emailLowerCase,
            senha:  hashSenha,
            papel:  papel
        });

        let usuario  = await novoUsuario.save();
        // 200 OK
        switch (usuario.papel) {
            case 1:
                console.log("novoUsuario > novoEducador >>>")
                result = await educadorService.novoEducador(usuario)
                if (result.status === 200) {
                    let copia = JSON.parse(JSON.stringify(usuario));
                    copia.educador = result.data.educador
                    usuario = copia
                }
                break;
            case 2:
                console.log("novoUsuario > novaCriança >>>")
                const data = { usuario: usuario, crianca: criancaReq }
                result = await criancaService.novaCrianca(req, data)
                if (result.status === 200) {
                    let copia = JSON.parse(JSON.stringify(usuario));
                    copia.crianca = result.data.crianca
                    usuario = copia
                }
                break;
            case 3:
                console.log("novoUsuario > novoApoiador >>>")
                result = { status: 200, data: { message: "Apoiador criado com sucesso" } }
                break;
            default: // 406 Not Acceptable
                await rollBackUsuario(usuario)
                return res.status(406).send({ status: 406, message: "Usuário não classificado" });
        }
        switch (result.status) {
            case 204: // 204 No Content
                await rollBackUsuario(usuario)
                res.status(result.status).send({ status: result.status, message: result.data.message });
                break;
            case 200: // 200 OK
                res.status(result.status).send({ status: result.status, message: result.data.message, usuario: usuario });
                break;
            default:
                console.log("novoUsuario > 200 > default > result >>>")
                console.log(result)
                await rollBackUsuario(usuario)
                // 500 Internal Server Error
                res.status(500).send({ status: 500, message: "Erro ao criar usuário" });
        }
    } catch (err){
        console.log("novoUsuario > err >>> ")
        console.log(err)
        // 500 Internal Server Error
        res.status(500).send({ status: 500, message: "Erro ao criar usuário" });
    }
}

exports.apagaUsuario = async (req, res) => {
    usuarioId = req.params.id
    try {
        const usuario = await Usuario.findOne({ _id: usuarioId }).exec();
        if(!usuario){
            // 204 No Content
            return res.status(204).send({ status: 204, message: 'Usuário não encontrado' });
        }

        // 200 OK
        switch (usuario.papel) {
            case 1:
                console.log("apagaUsuario > apagaEducador >>>")
                result = await educadorService.apagaEducador(usuario._id)
                break;
            case 2:
                console.log("apagaUsuario > apagaCriança >>>")
                result = await criancaService.apagaCrianca(usuario._id)
                break;
            case 3:
                console.log("apagaUsuario > apagaApoiador >>>")
                result = { status: 200, data: { message: "Sucesso" } }
                break;
            default: // 406 Not Acceptable
                return res.status(406).send({ status: 406, message: "Usuário não classificado" });
        }
        switch (result.status) {
            case 200: // 200 OK
            case 204: // 204 No Content
                await usuario.deleteOne()
                res.status(result.status).send({ status: result.status, message: result.data.message });
                break;
            default:
                console.log("apagaUsuario > 200 > default > result >>>")
                console.log(result)
                // 500 Internal Server Error
                res.status(500).send({ status: 500, message: "Erro ao apagar usuário" });
        }
    } catch (err){
        console.log("apagaUsuario > err >>>")
        console.log(err)
        // 500 Internal Server Error
        res.status(500).send({ status: 500, message: "Erro ao apagar Usuário" });
    }
}

const rollBackUsuario = async (usuario) => {
    try {
        // 200 OK
        await usuario.deleteOne()
        return { status: 200, message: 'Usuário apagado' }
    } catch (err){
        console.log("rollBackUsuario > err >>> ")
        console.log(err)
        // 500 Internal Server Error
        return { status: 500 }
    }
}

const validaUsuario = (usuario) => {
    const schema = Joi.object({
        nome:           Joi.string().required(),
        email:          Joi.string().required(),
        senha:          Joi.string().required(),
        confirmaSenha:  Joi.string().required(),
        papel:          Joi.number().integer().min(1).max(3).required()
    });
    return schema.validate(usuario);
}

const validaCrianca = (crianca) => {
    const schema = Joi.object({
        dt_nasc:        Joi.date().greater('1-1-2005').required(),
        ano_escolar:    Joi.number().required(),
        cidade:         Joi.string().required(),
        uf:             Joi.string().length(2).required(),
        telefone:       Joi.string().min(12).max(15).required(),
        observacoes:    Joi.string(),
        nivel_leitura:  Joi.number().integer().min(1).max(5).required(),
        educadorUsrId:  Joi.string().required()
    });
    return schema.validate(crianca);
}

const isEmail = (email) => {
    return emailValidator.validate(email)
}