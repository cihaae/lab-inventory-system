pipeline {
  agent any

  environment {
    LABSTOCK_PORT = '8081'
  }

  stages {
    stage('1. Checkout Code') {
      steps {
        echo 'Checking out source code from repository...'
        checkout scm
      }
    }

    stage('2. Syntax Check') {
      steps {
        echo 'Memvalidasi sintaks backend Python...'
        sh 'docker run --rm -v "$PWD/backend":/src -w /src python:3.12-slim python -m py_compile app.py'
      }
    }

    stage('3. Build & Deploy') {
      steps {
        echo 'Deploying application via Docker Compose...'
        sh '''
          docker compose down || true
          docker compose up --build -d
        '''
      }
    }

    stage('4. Health Check') {
      steps {
        echo 'Menjalankan health check endpoint...'
        sleep 5
        sh 'docker compose ps'
        sh 'curl -fsS http://localhost:8081/api/inventory || curl -fsS http://host.docker.internal:8081/api/inventory || docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen(\'http://127.0.0.1:5000/inventory\')"'
      }
    }
  }

  post {
    success {
      echo 'Pipeline LabStock berhasil dijalankan!'
    }
    failure {
      echo 'Pipeline LabStock gagal. Silakan periksa Console Output.'
    }
  }
}
