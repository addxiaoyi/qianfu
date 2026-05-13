package cn.exrick.dao;

import cn.exrick.bean.QianFuRecharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface QianFuRechargeDao extends JpaRepository<QianFuRecharge, Long> {

    Optional<QianFuRecharge> findByRechargeId(String rechargeId);

    Optional<QianFuRecharge> findByQianfuRechargeId(String qianfuRechargeId);

    List<QianFuRecharge> findByUserId(Long userId);

    List<QianFuRecharge> findByStatus(Integer status);

    List<QianFuRecharge> findByCreateTimeBetween(Date startTime, Date endTime);

    @Modifying
    @Query("UPDATE QianFuRecharge r SET r.status = :status WHERE r.rechargeId = :rechargeId")
    int updateStatus(@Param("rechargeId") String rechargeId, @Param("status") Integer status);

    @Modifying
    @Query("UPDATE QianFuRecharge r SET r.status = 1, r.completeTime = :completeTime WHERE r.rechargeId = :rechargeId")
    int updateRechargeSuccess(@Param("rechargeId") String rechargeId, @Param("completeTime") Date completeTime);

    @Modifying
    @Query("UPDATE QianFuRecharge r SET r.status = 2, r.failReason = :failReason WHERE r.rechargeId = :rechargeId")
    int updateRechargeFail(@Param("rechargeId") String rechargeId, @Param("failReason") String failReason);

    long countByStatus(Integer status);
}