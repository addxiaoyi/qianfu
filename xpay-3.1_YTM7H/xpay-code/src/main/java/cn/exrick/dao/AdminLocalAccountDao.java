package cn.exrick.dao;

import cn.exrick.bean.AdminLocalAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminLocalAccountDao extends JpaRepository<AdminLocalAccount, Long> {

    Optional<AdminLocalAccount> findByUsername(String username);

    Optional<AdminLocalAccount> findByAdminUserId(Long adminUserId);

    boolean existsByUsername(String username);
}
