package cn.exrick.dao;

import cn.exrick.bean.QrCodeLogin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QrCodeLoginDao extends JpaRepository<QrCodeLogin, Long> {

    Optional<QrCodeLogin> findByQrToken(String qrToken);

    Optional<QrCodeLogin> findBySceneCode(String sceneCode);

    Optional<QrCodeLogin> findByOpenidAndStatus(String openid, Integer status);
}
